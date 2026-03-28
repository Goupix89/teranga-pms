import { prisma } from './prisma';
import { logger } from './logger';

const PLANS = [
  {
    name: 'Basic',
    slug: 'basic',
    monthlyPrice: 32500,
    yearlyPrice: 325000,
    trialDays: 14,
    features: {
      maxEstablishments: 1,
      maxRooms: 20,
      maxUsers: 5,
      channelManager: false,
      posApp: false,
    },
    displayOrder: 1,
  },
  {
    name: 'Pro',
    slug: 'pro',
    monthlyPrice: 65000,
    yearlyPrice: 650000,
    trialDays: 14,
    features: {
      maxEstablishments: 3,
      maxRooms: 100,
      maxUsers: 20,
      channelManager: true,
      posApp: true,
    },
    displayOrder: 2,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    monthlyPrice: 130000,
    yearlyPrice: 1300000,
    trialDays: 14,
    features: {
      maxEstablishments: -1,
      maxRooms: -1,
      maxUsers: -1,
      channelManager: true,
      posApp: true,
    },
    displayOrder: 3,
  },
];

export async function seedPlans() {
  try {
    for (const plan of PLANS) {
      await prisma.subscriptionPlan.upsert({
        where: { slug: plan.slug },
        update: {
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          features: plan.features,
          displayOrder: plan.displayOrder,
          trialDays: plan.trialDays,
        },
        create: plan,
      });
    }
    logger.info(`✅ ${PLANS.length} subscription plans ensured`);
  } catch (err) {
    logger.error('Failed to seed subscription plans', { error: err });
  }
}
