import cron from 'node-cron';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';
import { channelSyncService } from '../services/channel-sync.service';
import { registrationService } from '../services/registration.service';

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
 * Subscription lifecycle management.
 * Runs daily at 7:00 AM.
 *
 * Timeline when subscription is NOT renewed:
 *   J-7  → Send renewal reminder email + generate FedaPay payment link
 *   J-3  → Second reminder
 *   J    → Status → PAST_DUE, grace period starts (7 days)
 *   J+7  → Status → SUSPENDED, tenant deactivated
 *   J+30 → Status → CANCELLED
 */
async function manageSubscriptions() {
  try {
    const now = new Date();

    // ── 1. TRIAL EXPIRING → convert to PENDING or extend ──
    const expiringTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { lte: now },
      },
      include: { tenant: true, plan: true },
    });

    for (const sub of expiringTrials) {
      try {
        // Trial expired → generate payment link and move to PENDING
        const checkoutUrl = await registrationService.generateRenewalLink(sub.tenantId);
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              status: 'PAST_DUE',
              gracePeriodEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          // Notify the tenant owner(s)
          const owners = await tx.establishmentMember.findMany({
            where: { role: 'OWNER', establishment: { tenantId: sub.tenantId } },
            select: { userId: true },
          });
          for (const owner of owners) {
            await tx.notification.create({
              data: {
                tenantId: sub.tenantId,
                userId: owner.userId,
                type: 'SYSTEM',
                title: 'Période d\'essai terminée',
                message: `Votre essai gratuit est terminé. Veuillez procéder au paiement pour continuer à utiliser Teranga PMS.${checkoutUrl ? ' Lien de paiement: ' + checkoutUrl : ''}`,
              },
            });
          }
        });
        logger.info('Trial expired, moved to PAST_DUE', { tenantId: sub.tenantId });
      } catch (err) {
        logger.error('Failed to handle trial expiration', { tenantId: sub.tenantId, error: String(err) });
      }
    }

    // ── 2. RENEWAL REMINDERS (J-7 and J-3) ──
    const reminderDays = [7, 3];
    for (const daysBeforeExpiry of reminderDays) {
      const targetDate = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const expiringSubs = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: { gte: dayStart, lt: dayEnd },
          cancelAtPeriodEnd: false,
        },
        include: { tenant: true, plan: true },
      });

      for (const sub of expiringSubs) {
        try {
          // Only send if we haven't sent a reminder today
          if (sub.lastRenewalLinkSentAt && sub.lastRenewalLinkSentAt > dayStart) continue;

          const checkoutUrl = await registrationService.generateRenewalLink(sub.tenantId);
          const owners = await prisma.establishmentMember.findMany({
            where: { role: 'OWNER', establishment: { tenantId: sub.tenantId } },
            select: { userId: true },
          });
          for (const owner of owners) {
            await prisma.notification.create({
              data: {
                tenantId: sub.tenantId,
                userId: owner.userId,
                type: 'SYSTEM',
                title: `Renouvellement dans ${daysBeforeExpiry} jours`,
                message: `Votre abonnement ${sub.plan.name} expire dans ${daysBeforeExpiry} jours.${checkoutUrl ? ' Renouvelez maintenant: ' + checkoutUrl : ''}`,
              },
            });
          }
          logger.info('Renewal reminder sent', { tenantId: sub.tenantId, daysBeforeExpiry });
        } catch (err) {
          logger.error('Failed to send renewal reminder', { tenantId: sub.tenantId, error: String(err) });
        }
      }
    }

    // ── 3. ACTIVE → PAST_DUE (period expired, not yet paid) ──
    const expiredActive = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lte: now },
      },
    });

    for (const sub of expiredActive) {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'PAST_DUE',
            gracePeriodEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        logger.info('Subscription moved to PAST_DUE', { tenantId: sub.tenantId });
      } catch (err) {
        logger.error('Failed to move subscription to PAST_DUE', { tenantId: sub.tenantId, error: String(err) });
      }
    }

    // ── 4. PAST_DUE → SUSPENDED (grace period ended) ──
    const pastDueSubs = await prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        gracePeriodEndsAt: { lte: now },
      },
    });

    for (const sub of pastDueSubs) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'SUSPENDED' },
          });
          await tx.tenant.update({
            where: { id: sub.tenantId },
            data: { isActive: false },
          });
        });
        logger.info('Subscription SUSPENDED, tenant deactivated', { tenantId: sub.tenantId });
      } catch (err) {
        logger.error('Failed to suspend subscription', { tenantId: sub.tenantId, error: String(err) });
      }
    }

    // ── 5. SUSPENDED → CANCELLED (30 days after suspension) ──
    const cancelCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const longSuspended = await prisma.subscription.findMany({
      where: {
        status: 'SUSPENDED',
        updatedAt: { lte: cancelCutoff },
      },
    });

    for (const sub of longSuspended) {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'CANCELLED' },
        });
        logger.info('Subscription CANCELLED after 30 days suspended', { tenantId: sub.tenantId });
      } catch (err) {
        logger.error('Failed to cancel subscription', { tenantId: sub.tenantId, error: String(err) });
      }
    }
  } catch (err) {
    logger.error('Subscription management job failed', { error: err });
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

  // Daily at 7:00 AM — subscription lifecycle management
  cron.schedule('0 7 * * *', manageSubscriptions, {
    timezone: 'Africa/Lome',
  });

  // Every minute — sync external calendars (iCal)
  cron.schedule('* * * * *', syncExternalCalendars, {
    timezone: 'Africa/Lome',
  });

  logger.info('Cron jobs registered');
}
