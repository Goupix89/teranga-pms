import bcrypt from 'bcryptjs';
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

const SUPERADMIN_EMAIL = 'superadmin@hoteldemo.com';
const SUPERADMIN_PASSWORD = 'Admin123!';

export async function seedPlans() {
  try {
    // Seed subscription plans
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

    // Seed platform tenant + superadmin
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'platform' },
      update: {},
      create: {
        name: 'Platform',
        slug: 'platform',
        plan: 'enterprise',
        isActive: true,
        settings: {},
      },
    });

    const existing = await prisma.user.findFirst({
      where: { email: SUPERADMIN_EMAIL, tenantId: tenant.id },
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: SUPERADMIN_EMAIL,
          passwordHash,
          firstName: 'Super',
          lastName: 'Admin',
          role: 'SUPERADMIN',
          phone: '+22890001234',
        },
      });
      logger.info(`✅ Superadmin created (${SUPERADMIN_EMAIL})`);
    } else {
      logger.info(`✅ Superadmin already exists`);
    }
  } catch (err) {
    logger.error('Failed to seed data', { error: err });
  }
}
