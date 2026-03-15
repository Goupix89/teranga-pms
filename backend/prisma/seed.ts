import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create subscription plans
  const plans = [
    {
      name: 'Basic',
      slug: 'basic',
      stripePriceIdMonthly: 'price_basic_monthly',
      stripePriceIdYearly: 'price_basic_yearly',
      monthlyPrice: 29,
      yearlyPrice: 290,
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
      stripePriceIdMonthly: 'price_pro_monthly',
      stripePriceIdYearly: 'price_pro_yearly',
      monthlyPrice: 79,
      yearlyPrice: 790,
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
      stripePriceIdMonthly: 'price_enterprise_monthly',
      stripePriceIdYearly: 'price_enterprise_yearly',
      monthlyPrice: 199,
      yearlyPrice: 1990,
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
      update: {},
      create: plan,
    });
  }

  console.log(`✅ ${plans.length} subscription plans created`);

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'hotel-demo' },
    update: {},
    create: {
      name: 'Hôtel Demo Lomé',
      slug: 'hotel-demo',
      plan: 'pro',
      settings: {
        currency: 'XOF',
        timezone: 'Africa/Lome',
        language: 'fr',
      },
    },
  });

  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // Create users — two-tier roles: SUPERADMIN (platform) + EMPLOYEE (establishment)
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  // SUPERADMIN — platform-level admin (bypasses all establishment checks)
  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'superadmin@hoteldemo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'superadmin@hoteldemo.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPERADMIN,
      phone: '+22890001234',
    },
  });

  // DAF — Establishment admin (Directeur Administratif et Financier)
  const daf = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'daf@hoteldemo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'daf@hoteldemo.com',
      passwordHash: await bcrypt.hash('Daf12345!', 12),
      firstName: 'Kokou',
      lastName: 'Mensah',
      role: UserRole.EMPLOYEE,
    },
  });

  // MANAGER
  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'manager@hoteldemo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'manager@hoteldemo.com',
      passwordHash: await bcrypt.hash('Manager123!', 12),
      firstName: 'Marie',
      lastName: 'Dupont',
      role: UserRole.EMPLOYEE,
    },
  });

  // SERVER (serveur)
  const server = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'serveur@hoteldemo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'serveur@hoteldemo.com',
      passwordHash: await bcrypt.hash('Serveur123!', 12),
      firstName: 'Afi',
      lastName: 'Agbeko',
      role: UserRole.EMPLOYEE,
    },
  });

  // POS
  const pos = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'pos@hoteldemo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'pos@hoteldemo.com',
      passwordHash: await bcrypt.hash('Pos12345!', 12),
      firstName: 'Yao',
      lastName: 'Koffi',
      role: UserRole.EMPLOYEE,
    },
  });

  // COOK (cuisinier)
  const cook = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'cuisinier@hoteldemo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'cuisinier@hoteldemo.com',
      passwordHash: await bcrypt.hash('Cook1234!', 12),
      firstName: 'Akossiwa',
      lastName: 'Tété',
      role: UserRole.EMPLOYEE,
    },
  });

  // CLEANER (ménage)
  const cleaner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'menage@hoteldemo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'menage@hoteldemo.com',
      passwordHash: await bcrypt.hash('Menage123!', 12),
      firstName: 'Ama',
      lastName: 'Sossou',
      role: UserRole.EMPLOYEE,
    },
  });

  console.log(`✅ Users: superadmin, daf, manager, serveur, pos, cuisinier, menage created`);

  // Create establishment
  const establishment = await prisma.establishment.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Hôtel Palm Beach' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Hôtel Palm Beach',
      address: '123 Boulevard du Mono',
      city: 'Lomé',
      country: 'Togo',
      phone: '+22822334455',
      email: 'contact@palmbeach.tg',
      starRating: 4,
      timezone: 'Africa/Lome',
      currency: 'XOF',
    },
  });

  console.log(`✅ Establishment: ${establishment.name}`);

  // Assign establishment memberships with roles
  const memberships = [
    { userId: daf.id, establishmentId: establishment.id, role: 'DAF' as const },
    { userId: manager.id, establishmentId: establishment.id, role: 'MANAGER' as const },
    { userId: server.id, establishmentId: establishment.id, role: 'SERVER' as const },
    { userId: pos.id, establishmentId: establishment.id, role: 'POS' as const },
    { userId: cook.id, establishmentId: establishment.id, role: 'COOK' as const },
    { userId: cleaner.id, establishmentId: establishment.id, role: 'CLEANER' as const },
  ];

  for (const m of memberships) {
    await prisma.establishmentMember.upsert({
      where: {
        userId_establishmentId: {
          userId: m.userId,
          establishmentId: m.establishmentId,
        },
      },
      update: { role: m.role },
      create: m,
    });
  }

  console.log(`✅ ${memberships.length} establishment memberships assigned`);

  // Create rooms
  const roomData = [
    { number: '101', floor: 1, type: 'SINGLE' as const, pricePerNight: 25000, maxOccupancy: 1 },
    { number: '102', floor: 1, type: 'SINGLE' as const, pricePerNight: 25000, maxOccupancy: 1 },
    { number: '103', floor: 1, type: 'DOUBLE' as const, pricePerNight: 40000, maxOccupancy: 2 },
    { number: '201', floor: 2, type: 'DOUBLE' as const, pricePerNight: 45000, maxOccupancy: 2 },
    { number: '202', floor: 2, type: 'DOUBLE' as const, pricePerNight: 45000, maxOccupancy: 2 },
    { number: '203', floor: 2, type: 'FAMILY' as const, pricePerNight: 65000, maxOccupancy: 4 },
    { number: '301', floor: 3, type: 'SUITE' as const, pricePerNight: 95000, maxOccupancy: 2 },
    { number: '302', floor: 3, type: 'DELUXE' as const, pricePerNight: 120000, maxOccupancy: 2 },
  ];

  for (const room of roomData) {
    await prisma.room.upsert({
      where: {
        tenantId_establishmentId_number: {
          tenantId: tenant.id,
          establishmentId: establishment.id,
          number: room.number,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        establishmentId: establishment.id,
        ...room,
        amenities: ['wifi', 'tv', 'climatisation'],
      },
    });
  }

  console.log(`✅ ${roomData.length} rooms created`);

  // Create article categories
  const catBoissons = await prisma.articleCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Boissons' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Boissons' },
  });

  const catNourriture = await prisma.articleCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Nourriture' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Nourriture' },
  });

  const catFournitures = await prisma.articleCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Fournitures' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Fournitures' },
  });

  console.log(`✅ Categories created`);

  // Create articles
  const articles = [
    { name: 'Eau minérale 1.5L', sku: 'BOI-001', unitPrice: 500, costPrice: 300, currentStock: 200, minimumStock: 50, unit: 'bouteille', categoryId: catBoissons.id },
    { name: 'Coca-Cola 33cl', sku: 'BOI-002', unitPrice: 800, costPrice: 500, currentStock: 150, minimumStock: 30, unit: 'canette', categoryId: catBoissons.id },
    { name: 'Bière Flag 65cl', sku: 'BOI-003', unitPrice: 1000, costPrice: 600, currentStock: 100, minimumStock: 20, unit: 'bouteille', categoryId: catBoissons.id },
    { name: 'Jus d\'orange 1L', sku: 'BOI-004', unitPrice: 1500, costPrice: 900, currentStock: 50, minimumStock: 15, unit: 'bouteille', categoryId: catBoissons.id },
    { name: 'Riz local 5kg', sku: 'NOU-001', unitPrice: 5000, costPrice: 3500, currentStock: 30, minimumStock: 10, unit: 'sac', categoryId: catNourriture.id },
    { name: 'Poulet entier', sku: 'NOU-002', unitPrice: 4000, costPrice: 2800, currentStock: 20, minimumStock: 5, unit: 'pièce', categoryId: catNourriture.id },
    { name: 'Savon hôtel', sku: 'FOU-001', unitPrice: 200, costPrice: 100, currentStock: 500, minimumStock: 100, unit: 'pièce', categoryId: catFournitures.id },
    { name: 'Serviette blanche', sku: 'FOU-002', unitPrice: 3000, costPrice: 2000, currentStock: 80, minimumStock: 20, unit: 'pièce', categoryId: catFournitures.id },
  ];

  for (const article of articles) {
    await prisma.article.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: article.sku } },
      update: {},
      create: { tenantId: tenant.id, ...article },
    });
  }

  console.log(`✅ ${articles.length} articles created`);

  // Create suppliers
  const suppliers = [
    { name: 'Brasserie BB Lomé', email: 'commandes@bblome.tg', phone: '+22822110011' },
    { name: 'Marché Grand Lomé', phone: '+22890556677' },
    { name: 'Fournitures Hôtelières SARL', email: 'contact@fh-sarl.tg', phone: '+22822889900' },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: supplier.name } },
      update: {},
      create: { tenantId: tenant.id, ...supplier },
    });
  }

  console.log(`✅ ${suppliers.length} suppliers created`);
  console.log('\n🎉 Seed complete!');
  console.log('   Login Super Admin:  superadmin@hoteldemo.com / Admin123!');
  console.log('   Login DAF:          daf@hoteldemo.com / Daf12345!');
  console.log('   Login Manager:      manager@hoteldemo.com / Manager123!');
  console.log('   Login Serveur:      serveur@hoteldemo.com / Serveur123!');
  console.log('   Login POS:          pos@hoteldemo.com / Pos12345!');
  console.log('   Login Cuisinier:    cuisinier@hoteldemo.com / Cook1234!');
  console.log('   Login Ménage:       menage@hoteldemo.com / Menage123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
