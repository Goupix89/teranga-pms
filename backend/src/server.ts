import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { extractTenantFromSubdomain } from './middlewares/tenant.middleware';
import { registerCronJobs } from './jobs/cron';

// Route imports
import authRouter from './routes/auth.routes';
import registrationRouter from './routes/registration.routes';
import { registrationService } from './services/registration.service';
import {
  userRouter,
  establishmentRouter,
  roomRouter,
  reservationRouter,
  invoiceRouter,
  paymentRouter,
  articleRouter,
  categoryRouter,
  stockMovementRouter,
  supplierRouter,
  integrationRouter,
} from './routes/resource.routes';

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

app.use(helmet({
  contentSecurityPolicy: config.isProd ? undefined : false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow non-browser requests

    const allowed = config.cors.allowedOrigins;
    if (allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.hotelpms\.com$/.test(origin)) {
      callback(null, true);
    } else {
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

// Stripe webhook needs raw body BEFORE express.json() parses it
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    await registrationService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Request logging
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

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

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

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

app.listen(PORT, () => {
  logger.info(`🚀 Hotel PMS API running on port ${PORT} (${config.nodeEnv})`);

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
