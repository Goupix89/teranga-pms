import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Check plan limits before creating resources.
 * Returns middleware that checks if the tenant has reached the limit for the given resource.
 */
export function checkPlanLimit(resource: 'rooms' | 'users' | 'establishments') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return next();

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: { select: { features: true, name: true } } },
      });

      // No subscription or no plan → allow (demo/dev mode)
      if (!subscription?.plan?.features) return next();

      const features = subscription.plan.features as Record<string, any>;

      let limit: number;
      let currentCount: number;
      let limitLabel: string;

      switch (resource) {
        case 'rooms': {
          limit = features.maxRooms ?? -1;
          if (limit === -1) return next(); // unlimited
          currentCount = await prisma.room.count({ where: { tenantId } });
          limitLabel = `chambres (max: ${limit})`;
          break;
        }
        case 'users': {
          limit = features.maxUsers ?? -1;
          if (limit === -1) return next();
          currentCount = await prisma.user.count({
            where: { tenantId, status: { not: 'ARCHIVED' } },
          });
          limitLabel = `utilisateurs (max: ${limit})`;
          break;
        }
        case 'establishments': {
          limit = features.maxEstablishments ?? -1;
          if (limit === -1) return next();
          currentCount = await prisma.establishment.count({ where: { tenantId } });
          limitLabel = `établissements (max: ${limit})`;
          break;
        }
        default:
          return next();
      }

      if (currentCount >= limit) {
        logger.warn('Plan limit reached', { tenantId, resource, currentCount, limit });
        return next(new AppError(
          `Limite de votre plan atteinte: ${limitLabel}. Passez à un plan supérieur pour en ajouter davantage.`,
          403,
          'PLAN_LIMIT_REACHED',
        ));
      }

      next();
    } catch (err) {
      // Don't block requests on plan check errors
      logger.error('Plan limit check error', { error: err });
      next();
    }
  };
}
