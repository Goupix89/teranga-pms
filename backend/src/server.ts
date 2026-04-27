import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';
import { seedPlans } from './utils/seed-plans';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { extractTenantFromSubdomain } from './middlewares/tenant.middleware';
import { registerCronJobs } from './jobs/cron';

// Route imports
import authRouter from './routes/auth.routes';
import registrationRouter from './routes/registration.routes';
import notificationRouter from './routes/notification.routes';
import { registrationService } from './services/registration.service';
import {
  userRouter,
  establishmentRouter,
  memberRouter,
  roomRouter,
  reservationRouter,
  orderRouter,
  invoiceRouter,
  paymentRouter,
  articleRouter,
  categoryRouter,
  stockMovementRouter,
  stockAlertRouter,
  supplierRouter,
  expenseRouter,
  expenseCategoryRouter,
  approvalRouter,
  cleaningRouter,
  restaurantTableRouter,
  dashboardConfigRouter,
  integrationRouter,
  channelRouter,
  apiKeyRouter,
  tenantSettingsRouter,
  subscriptionRouter,
  reportRouter,
  clientRouter,
  discountRouter,
} from './routes/resource.routes';
import { channelSyncService } from './services/channel-sync.service';

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

app.use(helmet({
  contentSecurityPolicy: config.isProd ? undefined : false,
}));

app.use(cors({
  origin: (rawOrigin, callback) => {
    if (!rawOrigin) return callback(null, true); // Allow non-browser requests

    // Some reverse proxies (OLS) duplicate the Origin header → take the first value
    const origin = rawOrigin.split(',')[0].trim();

    const allowed = config.cors.allowedOrigins;
    if (
      allowed.includes(origin) ||
      /^https:\/\/[a-z0-9-]+\.hotelpms\.com$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.jdidit\.cloud$/.test(origin)
    ) {
      callback(null, true);
    } else {
      logger.warn(`CORS rejected origin: ${origin}, allowed: ${allowed.join(', ')}`);
      callback(new Error('CORS non autorisé'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-ID', 'X-Api-Key', 'X-Request-ID'],
  maxAge: 86400,
}));

// =============================================================================
// GENERAL MIDDLEWARE
// =============================================================================

app.use(compression());

// Legacy Stripe webhook endpoint (kept for backwards compatibility, returns 410 Gone)
app.post('/api/webhooks/stripe', (_req: express.Request, res: express.Response) => {
  res.status(410).json({ error: 'Stripe webhooks are no longer supported. Use FedaPay.' });
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Request logging
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

// Public iCal feed — no auth, no tenant resolution needed (token-based)
app.get('/api/calendar/:token.ics', async (req, res, next) => {
  try {
    const ical = await channelSyncService.generateRoomIcal(req.params.token);
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store');
    res.set('X-Accel-Buffering', 'no');
    res.send(ical);
  } catch (err) {
    next(err);
  }
});

// FedaPay webhook — public endpoint, no tenant resolution needed
app.post('/api/webhooks/fedapay', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const event = req.body;
    logger.info('FedaPay webhook received', { type: event?.name, id: event?.entity?.id });

    // FedaPay sends events like "transaction.approved", "transaction.declined"
    if (event?.name === 'transaction.approved' && event?.entity) {
      const txn = event.entity;
      const fedapayTxnId = String(txn.id || txn.reference);

      // ── SUBSCRIPTION PAYMENT ──
      if (txn.custom_metadata?.type === 'subscription') {
        await registrationService.handleSubscriptionPayment(fedapayTxnId, txn.custom_metadata);
        res.json({ received: true });
        return;
      }

      // ── INVOICE / ORDER PAYMENT ──
      const transactionUuid = `fedapay_${fedapayTxnId}`;

      // Check if payment already recorded (idempotence)
      const existing = await prisma.payment.findUnique({
        where: { transactionUuid },
      });

      if (!existing) {
        // Find the invoice linked to this FedaPay transaction via custom metadata
        const invoiceIdFromMeta = txn.custom_metadata?.invoice_id;
        const reservationId = txn.custom_metadata?.reservation_id;

        let invoice: any = null;
        if (invoiceIdFromMeta) {
          invoice = await prisma.invoice.findFirst({
            where: { id: invoiceIdFromMeta, status: { not: 'CANCELLED' } },
          });
        }
        if (!invoice && reservationId) {
          invoice = await prisma.invoice.findFirst({
            where: { reservationId, status: { not: 'CANCELLED' } },
            orderBy: { createdAt: 'desc' },
          });
        }
        if (!invoice && reservationId) {
          const reservation = await prisma.reservation.findFirst({
            where: { externalRef: reservationId },
            select: { id: true },
          });
          if (reservation) {
            invoice = await prisma.invoice.findFirst({
              where: { reservationId: reservation.id, status: { not: 'CANCELLED' } },
              orderBy: { createdAt: 'desc' },
            });
          }
        }

        if (invoice) {
          const amount = (txn.amount || invoice.totalAmount.toNumber()) / 1;
          await prisma.payment.create({
            data: {
              tenantId: invoice.tenantId,
              invoiceId: invoice.id,
              amount: Math.min(amount, invoice.totalAmount.toNumber()),
              method: 'FEDAPAY',
              reference: fedapayTxnId,
              transactionUuid,
            },
          });

          // Extract customer info from FedaPay transaction and link to Client
          const customer = txn.customer || {};
          const firstName = customer.firstname || customer.first_name || '';
          const lastName = customer.lastname || customer.last_name || '';
          const email = customer.email || undefined;
          const phone = customer.phone?.number || customer.phone_number || undefined;
          if ((firstName || lastName) || email || phone) {
            try {
              const { clientService } = await import('./services/client.service');
              const client = await clientService.findOrCreate(invoice.tenantId, {
                firstName: firstName || 'Client',
                lastName: lastName || 'FedaPay',
                email,
                phone,
                source: 'FEDAPAY',
              });
              await prisma.invoice.update({
                where: { id: invoice.id },
                data: { clientId: client.id },
              });
              if (invoice.reservationId) {
                await prisma.reservation.update({
                  where: { id: invoice.reservationId },
                  data: { clientId: client.id },
                });
              }
            } catch (e) {
              logger.warn('Failed to link client from FedaPay', { error: (e as Error).message });
            }
          }

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID', paidAt: new Date() },
          });

          // Mark linked order as SERVED
          await prisma.order.updateMany({
            where: { invoiceId: invoice.id, status: { notIn: ['SERVED', 'CANCELLED'] } },
            data: { status: 'SERVED', servedAt: new Date() },
          });

          // Promote linked reservation PENDING → CONFIRMED (paid online)
          if (invoice.reservationId) {
            await prisma.reservation.updateMany({
              where: { id: invoice.reservationId, status: 'PENDING' },
              data: { status: 'CONFIRMED' },
            });
          }

          // Notify external system (WordPress)
          try {
            const tenantData = await prisma.tenant.findUnique({
              where: { id: invoice.tenantId },
              select: { settings: true },
            });
            const tenantSettings = (tenantData?.settings as Record<string, any>) || {};
            const webhookUrl = tenantSettings.paymentWebhookUrl;

            if (webhookUrl && invoice.reservationId) {
              const reservation = await prisma.reservation.findUnique({
                where: { id: invoice.reservationId },
                select: { externalRef: true, guestName: true, checkIn: true, checkOut: true },
              });
              if (reservation?.externalRef) {
                fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event: 'payment.completed',
                    reservationId: invoice.reservationId,
                    externalRef: reservation.externalRef,
                    guestName: reservation.guestName,
                    checkIn: reservation.checkIn,
                    checkOut: reservation.checkOut,
                    paymentMethod: 'FEDAPAY',
                    amount,
                    invoiceId: invoice.id,
                    paidAt: new Date().toISOString(),
                  }),
                }).catch(() => {});
              }
            }
          } catch {}

          logger.info('FedaPay payment recorded via webhook', {
            invoiceId: invoice.id,
            reservationId,
            fedapayTxnId,
            amount,
          });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('FedaPay webhook error', { error: err });
    // Always return 200 to FedaPay to prevent retries on our errors
    res.json({ received: true });
  }
});

// Tenant resolution from subdomain
app.use(extractTenantFromSubdomain);

// =============================================================================
// RATE LIMITING
// =============================================================================

const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Trop de requêtes. Réessayez plus tard.', code: 'RATE_LIMIT' },
  keyGenerator: (req) => {
    // Rate limit by IP + tenantId to isolate tenants
    return `${req.ip}_${req.tenantId || 'unknown'}`;
  },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.', code: 'RATE_LIMIT' },
});

if (config.isProd) {
  app.use('/api/', generalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/refresh', authLimiter);
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// =============================================================================
// FILE UPLOADS
// =============================================================================

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou WebP.'));
    }
  },
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Aucun fichier envoyé' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, data: { imageUrl } });
});

// =============================================================================
// API ROUTES
// =============================================================================

app.use('/api/auth', authRouter);
app.use('/api/registration', registrationRouter);
app.use('/api/users', userRouter);
app.use('/api/establishments', establishmentRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/articles', articleRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/stock-movements', stockMovementRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/orders', orderRouter);
app.use('/api/approvals', approvalRouter);
app.use('/api/cleaning', cleaningRouter);
app.use('/api/restaurant-tables', restaurantTableRouter);
app.use('/api/dashboard-config', dashboardConfigRouter);
app.use('/api/stock-alerts', stockAlertRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/expense-categories', expenseCategoryRouter);
app.use('/api/notifications', notificationRouter);

// Establishment members (nested under /api/establishments/:establishmentId/members)
app.use('/api/establishments', memberRouter);

// Channel sync (iCal)
app.use('/api/channels', channelRouter);

// API Keys management
app.use('/api/api-keys', apiKeyRouter);

// Tenant settings (FedaPay config, etc.) — OWNER only
app.use('/api/tenant/settings', tenantSettingsRouter);

// Subscription management — SUPERADMIN only
app.use('/api/subscriptions', subscriptionRouter);
app.use('/api/reports', reportRouter);
app.use('/api/clients', clientRouter);
app.use('/api/discount-rules', discountRouter);

// Integration endpoints (availability, external bookings, POS)
app.use('/api', integrationRouter);

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =============================================================================
// SERVER START
// =============================================================================

const PORT = config.port;

app.listen(PORT, async () => {
  logger.info(`🚀 Hotel PMS API running on port ${PORT} (${config.nodeEnv})`);

  // Ensure subscription plans exist
  await seedPlans();

  // Register cron jobs
  if (config.isProd || process.env.ENABLE_CRON === 'true') {
    registerCronJobs();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

export default app;
