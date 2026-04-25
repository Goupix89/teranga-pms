/**
 * CLI: backfill invoices + payments for channel-imported reservations that
 * predate the channel-sync fix.
 *
 * Usage from the backend directory:
 *   npx tsx scripts/backfill-channel-invoices.ts                  # all tenants
 *   npx tsx scripts/backfill-channel-invoices.ts --tenant=<id>    # one tenant
 *   npx tsx scripts/backfill-channel-invoices.ts --slug=<slug>    # by tenant slug
 *   npx tsx scripts/backfill-channel-invoices.ts --dry-run        # preview only
 *
 * In Docker:
 *   docker compose -f docker-compose.prod.yml exec backend \
 *     npx tsx scripts/backfill-channel-invoices.ts
 *
 * Idempotent — skips reservations that already have an invoice. Safe to re-run.
 */

import { prisma } from '../src/utils/prisma';
import { reservationService } from '../src/services/reservation.service';

type Args = { tenant?: string; slug?: string; dryRun: boolean };

function parseArgs(): Args {
  const args: Args = { dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length);
    else if (arg.startsWith('--slug=')) args.slug = arg.slice('--slug='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npx tsx scripts/backfill-channel-invoices.ts                # all tenants
  npx tsx scripts/backfill-channel-invoices.ts --tenant=<id>  # one tenant
  npx tsx scripts/backfill-channel-invoices.ts --slug=<slug>  # by tenant slug
  npx tsx scripts/backfill-channel-invoices.ts --dry-run      # count only`);
      process.exit(0);
    }
  }
  return args;
}

async function pickTenants(args: Args) {
  if (args.tenant) {
    const t = await prisma.tenant.findUnique({ where: { id: args.tenant }, select: { id: true, slug: true, name: true } });
    return t ? [t] : [];
  }
  if (args.slug) {
    const t = await prisma.tenant.findUnique({ where: { slug: args.slug }, select: { id: true, slug: true, name: true } });
    return t ? [t] : [];
  }
  return prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function dryRun(tenantId: string) {
  const candidates = await prisma.reservation.findMany({
    where: {
      tenantId,
      source: { in: ['BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'CHANNEL_MANAGER'] },
      status: { not: 'CANCELLED' },
      invoices: { none: {} },
    },
    select: {
      id: true, source: true, guestName: true, totalPrice: true,
      checkIn: true, checkOut: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return candidates;
}

async function main() {
  const args = parseArgs();
  const tenants = await pickTenants(args);

  if (tenants.length === 0) {
    console.error('Aucun tenant correspondant.');
    process.exit(1);
  }

  console.log(`\n${args.dryRun ? '[DRY-RUN] ' : ''}Backfill sur ${tenants.length} tenant(s)\n`);

  const totals = { scanned: 0, created: 0, skipped: 0, errors: 0 };

  for (const t of tenants) {
    console.log(`── ${t.name} (${t.slug}) ──────────────`);

    if (args.dryRun) {
      const list = await dryRun(t.id);
      console.log(`  ${list.length} réservation(s) sans facture :`);
      for (const r of list) {
        console.log(
          `    [${r.source}] ${r.guestName} · ${r.checkIn.toISOString().slice(0, 10)} → ${r.checkOut.toISOString().slice(0, 10)} · ${Number(r.totalPrice)} FCFA · créée ${r.createdAt.toISOString().slice(0, 10)}`
        );
      }
      totals.scanned += list.length;
      continue;
    }

    try {
      const r = await reservationService.backfillChannelInvoices(t.id);
      console.log(`  Scanned:           ${r.scanned}`);
      console.log(`  Factures créées:   ${r.invoicesCreated}`);
      console.log(`  Paiements créés:   ${r.paymentsCreated}`);
      console.log(`  Ignorés (erreurs): ${r.skipped}`);
      if (r.errors.length > 0) {
        console.log(`  Erreurs:`);
        for (const e of r.errors) {
          console.log(`    - ${e.reservationId}: ${e.error}`);
        }
      }
      totals.scanned += r.scanned;
      totals.created += r.invoicesCreated;
      totals.skipped += r.skipped;
      totals.errors += r.errors.length;
    } catch (e: any) {
      console.error(`  ÉCHEC: ${e.message || e}`);
      totals.errors++;
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════');
  console.log(`Total scanné:            ${totals.scanned}`);
  if (!args.dryRun) {
    console.log(`Total factures créées:   ${totals.created}`);
    console.log(`Total ignorés:           ${totals.skipped}`);
    console.log(`Total erreurs:           ${totals.errors}`);
  }
  console.log('═══════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erreur fatale:', e);
  await prisma.$disconnect();
  process.exit(1);
});
