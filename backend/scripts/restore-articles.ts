import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const total = await prisma.article.count();
  const inactive = await prisma.article.count({ where: { isActive: false } });
  const unapproved = await prisma.article.count({ where: { isApproved: false } });
  const hidden = await prisma.article.count({
    where: { OR: [{ isActive: false }, { isApproved: false }] },
  });

  console.log('État actuel :');
  console.log(`  Total articles     : ${total}`);
  console.log(`  isActive = false   : ${inactive}`);
  console.log(`  isApproved = false : ${unapproved}`);
  console.log(`  Cachés (au moins un des deux) : ${hidden}`);

  if (hidden === 0) {
    console.log('\nAucun article caché — rien à restaurer.');
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.article.updateMany({
    where: { OR: [{ isActive: false }, { isApproved: false }] },
    data: { isActive: true, isApproved: true },
  });

  console.log(`\n✓ ${result.count} article(s) restauré(s) (isActive=true, isApproved=true).`);
  await prisma.$disconnect();
})();
