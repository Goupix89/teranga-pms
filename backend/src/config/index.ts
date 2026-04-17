import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  isProd: process.env.NODE_ENV === 'production',

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10),
  },

  cors: {
    originPattern: process.env.CORS_ORIGIN_PATTERN || 'http://localhost:*',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  archival: {
    inactivityDays: parseInt(process.env.INACTIVITY_THRESHOLD_DAYS || '365', 10),
  },

  stock: {
    varianceThresholdPercent: parseFloat(process.env.STOCK_VARIANCE_THRESHOLD_PERCENT || '10'),
  },

  fedapay: {
    secretKey: process.env.FEDAPAY_SECRET_KEY || '',
    isSandbox: process.env.FEDAPAY_SANDBOX !== 'false',
    callbackUrl: process.env.FEDAPAY_CALLBACK_URL || 'http://localhost:3001/dashboard',
    webhookSecret: process.env.FEDAPAY_WEBHOOK_SECRET || '',
  },

  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3001',

  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@teranga.jdidit.cloud',
  },
} as const;

// Validate critical config at startup
const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    if (config.isProd) process.exit(1);
  }
}
