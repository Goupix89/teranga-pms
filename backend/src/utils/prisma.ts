import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';

// Singleton PrismaClient
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ]
      : [{ level: 'error', emit: 'stdout' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    if (e.duration > 100) {
      logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}

// =============================================================================
// Tenant-scoped Prisma extension
// =============================================================================

// Models that require tenant isolation
const TENANT_MODELS = [
  'User', 'Establishment', 'Room', 'Reservation', 'Invoice', 'InvoiceItem',
  'Payment', 'Article', 'ArticleCategory', 'Supplier', 'StockMovement',
  'RefreshToken', 'ApiKey',
];

/**
 * Creates a Prisma client extension that automatically injects tenantId
 * into all queries for tenant-scoped models.
 */
export function createTenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_MODELS.includes(model)) {
          return query(args);
        }

        // Inject tenantId into where clauses
        if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
          args.where = { ...args.where, tenantId };
        }

        if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
          args.where = { ...args.where, tenantId };
        }

        // Inject tenantId into create data
        if (operation === 'create') {
          args.data = { ...args.data, tenantId };
        }

        if (operation === 'createMany') {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d: any) => ({ ...d, tenantId }));
          }
        }

        if (operation === 'upsert') {
          args.where = { ...args.where, tenantId };
          args.create = { ...args.create, tenantId };
        }

        return query(args);
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantClient>;
