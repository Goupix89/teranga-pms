import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const prisma = new PrismaClient();
const mapping = require(path.join(__dirname, 'ko-mapping.json'));

type MappingEntry = {
  ko: string;
  nb_commandes: number;
  article_cible: string | null;
};

const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  console.log(DRY_RUN ? '=== MODE DRY-RUN (aucune modification) ===' : '=== MODE RÉEL ===');
  console.log();

  const entries: MappingEntry[] = (mapping.mapping as MappingEntry[]).filter(
    (e) => e.article_cible !== null,
  );

  let totalOrderItems = 0;
  let totalInvoiceItems = 0;
  let totalKoDeactivated = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    const koName = entry.ko;
    const cibleName = entry.article_cible!;

    const koArticle = await prisma.article.findFirst({ where: { name: koName } });
    if (!koArticle) {
      errors.push(`[MANQUANT] Article KO introuvable : "${koName}"`);
      continue;
    }

    const cibleArticle = await prisma.article.findFirst({ where: { name: cibleName } });
    if (!cibleArticle) {
      errors.push(`[MANQUANT] Article cible introuvable : "${cibleName}" (pour ${koName})`);
      continue;
    }

    const orderItemCount = await prisma.orderItem.count({ where: { articleId: koArticle.id } });
    const invoiceItemCount = await prisma.invoiceItem.count({ where: { articleId: koArticle.id } });

    console.log(`${koName} → "${cibleName}"`);
    console.log(`  order_items   : ${orderItemCount}`);
    console.log(`  invoice_items : ${invoiceItemCount}`);

    if (!DRY_RUN) {
      if (orderItemCount > 0) {
        await prisma.orderItem.updateMany({
          where: { articleId: koArticle.id },
          data: { articleId: cibleArticle.id },
        });
      }

      if (invoiceItemCount > 0) {
        await prisma.invoiceItem.updateMany({
          where: { articleId: koArticle.id },
          data: { articleId: cibleArticle.id },
        });
      }

      await prisma.article.update({
        where: { id: koArticle.id },
        data: { isActive: false },
      });

      console.log(`  ✓ Migré et désactivé.`);
    }

    totalOrderItems += orderItemCount;
    totalInvoiceItems += invoiceItemCount;
    totalKoDeactivated++;
  }

  console.log();
  console.log('=== RÉSUMÉ ===');
  console.log(`  Articles KO traités     : ${totalKoDeactivated}`);
  console.log(`  order_items migrés      : ${totalOrderItems}`);
  console.log(`  invoice_items migrés    : ${totalInvoiceItems}`);

  if (errors.length > 0) {
    console.log();
    console.log('=== ERREURS ===');
    errors.forEach((e) => console.log(' ', e));
  }

  if (DRY_RUN) {
    console.log();
    console.log('Dry-run terminé. Relancer sans --dry-run pour appliquer.');
  }

  await prisma.$disconnect();
})();
