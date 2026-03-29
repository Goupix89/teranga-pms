import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding MINIMAL database...');

  // ================================
  // 1. Plans d'abonnement
  // ================================
  const plans = [
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

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        features: plan.features,
      },
      create: plan,
    });
  }

  console.log(`✅ ${plans.length} plans créés`);

  // ================================
  // 2. Tenant minimal (plateforme)
  // ================================
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'platform-root' },
    update: {},
    create: {
      name: 'Platform Root',
      slug: 'platform-root',
      plan: 'enterprise',
      settings: {
        currency: 'XOF',
        timezone: 'Africa/Lome',
        language: 'fr',
      },
    },
  });

  console.log(`✅ Tenant créé: ${tenant.name}`);

  // ================================
  // 3. Super Admin
  // ================================
  const password = 'Admin123!'; // ⚠️ à changer en prod
  const passwordHash = await bcrypt.hash(password, 12);

  const superAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@platform.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@platform.com',
      passwordHash,
      firstName: 'Platform',
      lastName: 'Admin',
      role: UserRole.SUPERADMIN,
    },
  });

  console.log(`✅ SuperAdmin créé: ${superAdmin.email}`);

  console.log('\n🎉 Minimal seed complete!');
  console.log('   Login Admin: admin@platform.com / Admin123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });