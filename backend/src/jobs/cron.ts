import cron from 'node-cron';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';
import { channelSyncService } from '../services/channel-sync.service';

/**
 * Archive inactive users.
 * Runs daily at 3:00 AM.
 */
async function archiveInactiveUsers() {
  try {
    const cutoff = new Date(Date.now() - config.archival.inactivityDays * 24 * 60 * 60 * 1000);

    const inactiveUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        lastActiveAt: { lt: cutoff },
        role: { not: 'SUPERADMIN' },
      },
      select: { id: true, tenantId: true, email: true, lastActiveAt: true },
    });

    let archived = 0;
    for (const user of inactiveUsers) {
      try {
        await prisma.$transaction([
          prisma.refreshToken.updateMany({
            where: { userId: user.id },
            data: { revoked: true },
          }),
          prisma.user.update({
            where: { id: user.id },
            data: {
              status: 'ARCHIVED',
              archivedAt: new Date(),
              email: `archived_${user.id}@deleted.local`,
              phone: null,
            },
          }),
        ]);
        archived++;
      } catch (err) {
        logger.error('Failed to archive user', { userId: user.id, error: err });
      }
    }

    if (archived > 0) {
      logger.info(`Archived ${archived} inactive users`);
    }
  } catch (err) {
    logger.error('Archive job failed', { error: err });
  }
}

/**
 * Mark overdue invoices.
 * Runs daily at 6:00 AM.
 */
async function markOverdueInvoices() {
  try {
    const result = await prisma.invoice.updateMany({
      where: {
        status: 'ISSUED',
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });

    if (result.count > 0) {
      logger.info(`Marked ${result.count} invoices as overdue`);
    }
  } catch (err) {
    logger.error('Overdue invoice job failed', { error: err });
  }
}

/**
 * Clean expired refresh tokens.
 * Runs daily at 4:00 AM.
 */
async function cleanExpiredTokens() {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true, createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned ${result.count} expired/revoked tokens`);
    }
  } catch (err) {
    logger.error('Token cleanup job failed', { error: err });
  }
}

/**
 * Sync external calendars (iCal import from OTAs).
 * Runs every 15 minutes.
 */
async function syncExternalCalendars() {
  try {
    const connections = await prisma.channelConnection.findMany({
      where: {
        isActive: true,
        importUrl: { not: null },
      },
    });

    let synced = 0;
    let errors = 0;

    for (const conn of connections) {
      // Respect individual sync interval
      if (conn.lastSyncAt) {
        const msSinceLastSync = Date.now() - conn.lastSyncAt.getTime();
        if (msSinceLastSync < conn.syncIntervalMin * 60 * 1000) continue;
      }

      try {
        await channelSyncService.syncInbound(conn.id);
        synced++;
      } catch (err) {
        errors++;
        logger.error('Channel sync failed', { connectionId: conn.id, error: err });
      }
    }

    if (synced > 0 || errors > 0) {
      logger.info(`Channel sync: ${synced} synced, ${errors} errors`);
    }
  } catch (err) {
    logger.error('Channel sync job failed', { error: err });
  }
}

/**
 * Register all cron jobs.
 */
export function registerCronJobs() {
  // Daily at 3:00 AM — archive inactive users
  cron.schedule('0 3 * * *', archiveInactiveUsers, {
    timezone: 'Africa/Lome',
  });

  // Daily at 4:00 AM — clean expired tokens
  cron.schedule('0 4 * * *', cleanExpiredTokens, {
    timezone: 'Africa/Lome',
  });

  // Daily at 6:00 AM — mark overdue invoices
  cron.schedule('0 6 * * *', markOverdueInvoices, {
    timezone: 'Africa/Lome',
  });

  // Every minute — sync external calendars (iCal)
  cron.schedule('* * * * *', syncExternalCalendars, {
    timezone: 'Africa/Lome',
  });

  logger.info('Cron jobs registered');
}
