import { Prisma, ReservationStatus, BookingSource, PaymentMethod } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { calculateNights, paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';
import { logger } from '../utils/logger';

export class ReservationService {
  /**
   * List reservations with filters and pagination.
   */
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: {
      status?: ReservationStatus;
      roomId?: string;
      from?: string;
      to?: string;
      source?: BookingSource;
      search?: string;
      establishmentIds?: string[];
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: Prisma.ReservationWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.roomId && { roomId: filters.roomId }),
      ...(filters.source && { source: filters.source }),
      ...(filters.establishmentIds && { room: { establishmentId: { in: filters.establishmentIds } } }),
      ...(filters.from && { checkIn: { gte: new Date(filters.from) } }),
      ...(filters.to && { checkOut: { lte: new Date(filters.to) } }),
      ...(filters.search && {
        OR: [
          { guestName: { contains: filters.search, mode: 'insensitive' as const } },
          { guestEmail: { contains: filters.search, mode: 'insensitive' as const } },
          { externalRef: { contains: filters.search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      db.reservation.findMany({
        where,
        include: {
          room: { select: { id: true, number: true, type: true, establishment: { select: { name: true } } } },
          invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, paymentMethod: true }, take: 1, orderBy: { createdAt: 'desc' as const } },
        },
        ...toSkipTake(params),
      }),
      db.reservation.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  /**
   * Get a single reservation by ID.
   */
  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const reservation = await db.reservation.findFirst({
      where: { id },
      include: {
        room: { select: { id: true, number: true, type: true, pricePerNight: true, establishment: { select: { name: true } } } },
        invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
      },
    });

    if (!reservation) throw new NotFoundError('Réservation');
    return reservation;
  }

  /**
   * Create a new reservation with availability check.
   */
  async create(tenantId: string, data: {
    roomId: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    checkIn: string;
    checkOut: string;
    numberOfGuests: number;
    source: BookingSource;
    paymentMethod?: PaymentMethod;
    notes?: string;
    externalRef?: string;
    paidAmount?: number;      // amount already paid upstream (channel manager / online)
    discountRuleId?: string;  // staff-selected owner-created discount rule (applied directly)
  }, userId?: string) {
    const checkInDate = new Date(data.checkIn);
    const checkOutDate = new Date(data.checkOut);

    // Use a transaction to prevent race conditions (double booking)
    return prisma.$transaction(async (tx) => {
      // 1. Verify room exists and belongs to tenant
      const room = await tx.room.findFirst({
        where: { id: data.roomId, tenantId, isActive: true },
      });

      if (!room) throw new NotFoundError('Chambre');

      // 2. Check guest count vs capacity
      if (data.numberOfGuests > room.maxOccupancy) {
        throw new ValidationError(`Cette chambre accepte maximum ${room.maxOccupancy} personnes`);
      }

      // 3. Check availability (critical — prevent double booking)
      const conflict = await tx.reservation.findFirst({
        where: {
          tenantId,
          roomId: data.roomId,
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          checkIn: { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
      });

      if (conflict) {
        throw new ConflictError(
          `Chambre ${room.number} non disponible du ${data.checkIn} au ${data.checkOut}`
        );
      }

      // 4. Calculate total price
      const nights = calculateNights(checkInDate, checkOutDate);
      const subtotal = Number(room.pricePerNight.mul(nights));

      // 4b. Resolve discount — Owner-defined auto rules always apply (best-match),
      // and a manually-selected Owner rule stacks ON TOP against the remaining base.
      let discountRuleId: string | null = null;       // manual rule id (if any)
      let autoDiscountRuleId: string | null = null;   // owner auto rule id (if any)
      let discountAmount = 0;                         // total = auto + manual
      let autoDiscountAmount = 0;                     // owner auto portion
      {
        const { discountService } = await import('./discount.service');

        // Owner auto rule (autoApply=true) — always applied when matching
        const auto = await discountService.findAutoReservationDiscount(tenantId, { nights, subtotal });
        if (auto) {
          autoDiscountRuleId = auto.rule.id;
          autoDiscountAmount = auto.amount;
        }

        // Manual rule stacks on top, computed against the remaining base (no double-dip)
        const baseAfterAuto = Math.max(0, subtotal - autoDiscountAmount);
        let manualAmount = 0;

        if (data.discountRuleId) {
          const applied = await discountService.apply(tenantId, data.discountRuleId, {
            nights, subtotal: baseAfterAuto, appliesTo: 'RESERVATION',
          });
          discountRuleId = applied.rule.id;
          manualAmount = applied.amount;
        }

        discountAmount = Math.min(autoDiscountAmount + manualAmount, subtotal);
      }
      const totalPrice = Math.max(0, subtotal - discountAmount);

      // 4c. Create/find Client from guest info — always create so every guest
      // is searchable in the Clients menu, even when email/phone is missing
      // (the channel sometimes hides them).
      let clientId: string | null = null;
      {
        const { clientService } = await import('./client.service');
        const [firstName, ...rest] = data.guestName.trim().split(/\s+/);
        const client = await clientService.findOrCreate(tenantId, {
          firstName: firstName || data.guestName,
          lastName: rest.join(' '),
          email: data.guestEmail,
          phone: data.guestPhone,
          source: data.source,
        });
        clientId = client.id;
      }

      // 5. Create reservation
      const reservation = await tx.reservation.create({
        data: {
          tenantId,
          roomId: data.roomId,
          clientId,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          numberOfGuests: data.numberOfGuests,
          status: 'CONFIRMED',
          source: data.source,
          externalRef: data.externalRef,
          totalPrice,
          discountRuleId,
          discountAmount,
          autoDiscountRuleId,
          autoDiscountAmount,
          notes: data.notes,
        },
        include: {
          room: { select: { number: true, type: true } },
        },
      });

      // 6. Auto-generate invoice for the reservation
      let invoiceId: string | undefined;
      const needsInvoice = !!userId || (data.source !== 'DIRECT') || (data.paidAmount ?? 0) > 0;
      if (needsInvoice) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const todayStart = new Date(now.toISOString().slice(0, 10));
        const lastInvoice = await tx.invoice.findFirst({
          where: { tenantId, createdAt: { gte: todayStart } },
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true },
        });
        const lastNum = lastInvoice
          ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10)
          : 0;
        const invoiceNumber = `FAC-${dateStr}-${String(lastNum + 1).padStart(4, '0')}`;

        const systemUserId = userId || (await tx.user.findFirst({
          where: { tenantId, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        }))?.id;
        if (!systemUserId) throw new ValidationError('Aucun utilisateur système trouvé pour émettre la facture');

        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            reservationId: reservation.id,
            clientId,
            createdById: systemUserId,
            invoiceNumber,
            subtotal,
            taxAmount: 0,
            taxRate: 0,
            discountRuleId,
            discountAmount,
            autoDiscountRuleId,
            autoDiscountAmount,
            totalAmount: totalPrice,
            paymentMethod: data.paymentMethod || null,
            notes: `Hébergement ${data.guestName} — Chambre ${reservation.room.number} (${nights} nuit${nights > 1 ? 's' : ''})${data.source !== 'DIRECT' ? ` [${data.source}]` : ''}`,
            status: 'ISSUED',
            items: {
              create: [
                {
                  description: `Chambre ${reservation.room.number} (${reservation.room.type}) — ${nights} nuit${nights > 1 ? 's' : ''}`,
                  quantity: nights,
                  unitPrice: Number(room.pricePerNight),
                  totalPrice: subtotal,
                },
              ],
            },
          },
        });
        invoiceId = invoice.id;

        // 7. If paid upstream (channel manager / platform), record a Payment automatically
        const paidAmount = Number(data.paidAmount || 0);
        if (paidAmount > 0) {
          const capped = Math.min(paidAmount, totalPrice);
          const method = data.paymentMethod || (data.source === 'DIRECT' ? 'CASH' : 'OTHER');
          await tx.payment.create({
            data: {
              tenantId,
              invoiceId: invoice.id,
              amount: capped,
              method,
              reference: data.externalRef || `channel:${data.source}`,
            },
          });
          if (capped >= totalPrice) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: 'PAID', paidAt: new Date() },
            });
          }
        }
      }

      logger.info('Reservation created', {
        tenantId,
        reservationId: reservation.id,
        roomId: data.roomId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        source: data.source,
        invoiceId,
        discountRuleId,
        autoDiscountRuleId,
        discountAmount,
        autoDiscountAmount,
      });

      return { ...reservation, invoiceId, paymentMethod: data.paymentMethod };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Update a reservation (only if not checked out/cancelled).
   */
  async update(tenantId: string, id: string, data: {
    guestName?: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
    checkIn?: string;
    checkOut?: string;
    roomId?: string;
    numberOfGuests?: number;
    notes?: string | null;
    discountRuleId?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: { id, tenantId },
        include: {
          room: true,
          invoices: { select: { id: true, status: true, paidAt: true } },
        },
      });

      if (!existing) throw new NotFoundError('Réservation');

      if (['CHECKED_OUT', 'CANCELLED'].includes(existing.status)) {
        throw new ValidationError('Impossible de modifier une réservation terminée ou annulée');
      }

      // Refuse if any linked invoice is already paid or cancelled — modifying
      // the totals would leave accounting inconsistent.
      const blockedInvoice = existing.invoices.find((i: any) => ['PAID', 'CANCELLED'].includes(i.status));
      if (blockedInvoice) {
        throw new ValidationError(
          `Facture ${blockedInvoice.status === 'PAID' ? 'déjà payée' : 'annulée'} — modification de la réservation refusée`
        );
      }

      const checkInDate = data.checkIn ? new Date(data.checkIn) : existing.checkIn;
      const checkOutDate = data.checkOut ? new Date(data.checkOut) : existing.checkOut;
      const newRoomId = data.roomId ?? existing.roomId;
      const datesChanged = !!data.checkIn || !!data.checkOut;
      const roomChanged = data.roomId && data.roomId !== existing.roomId;

      // Resolve target room (may be unchanged)
      const room = roomChanged
        ? await tx.room.findFirst({ where: { id: newRoomId, tenantId, isActive: true } })
        : existing.room;
      if (!room) throw new NotFoundError('Chambre');

      // Validate guest count vs new room capacity
      const numberOfGuests = data.numberOfGuests ?? existing.numberOfGuests;
      if (numberOfGuests > room.maxOccupancy) {
        throw new ValidationError(`Cette chambre accepte maximum ${room.maxOccupancy} personnes`);
      }

      // Re-check availability if dates or room changed
      if (datesChanged || roomChanged) {
        const conflict = await tx.reservation.findFirst({
          where: {
            tenantId,
            roomId: newRoomId,
            id: { not: id },
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
            checkIn: { lt: checkOutDate },
            checkOut: { gt: checkInDate },
          },
        });
        if (conflict) {
          throw new ConflictError('Les nouvelles dates / chambre chevauchent une autre réservation');
        }
      }

      // Recalculate subtotal + discount
      const nights = calculateNights(checkInDate, checkOutDate);
      const subtotal = Number(room.pricePerNight.mul(nights));

      // Re-resolve discount: auto + manual (manual id only changes if explicitly passed)
      const { discountService } = await import('./discount.service');
      const auto = await discountService.findAutoReservationDiscount(tenantId, { nights, subtotal });
      const autoDiscountRuleId: string | null = auto?.rule.id ?? null;
      const autoDiscountAmount = auto?.amount ?? 0;

      const baseAfterAuto = Math.max(0, subtotal - autoDiscountAmount);
      let manualRuleId: string | null = data.discountRuleId === undefined
        ? existing.discountRuleId
        : data.discountRuleId;
      let manualAmount = 0;
      if (manualRuleId) {
        try {
          const applied = await discountService.apply(tenantId, manualRuleId, {
            nights, subtotal: baseAfterAuto, appliesTo: 'RESERVATION',
          });
          manualAmount = applied.amount;
          manualRuleId = applied.rule.id;
        } catch {
          // Stale rule (deactivated since) — drop it silently
          manualRuleId = null;
          manualAmount = 0;
        }
      }
      const discountAmount = Math.min(autoDiscountAmount + manualAmount, subtotal);
      const totalPrice = Math.max(0, subtotal - discountAmount);

      // Update the reservation
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          ...(data.guestName !== undefined && { guestName: data.guestName }),
          ...(data.guestEmail !== undefined && { guestEmail: data.guestEmail }),
          ...(data.guestPhone !== undefined && { guestPhone: data.guestPhone }),
          ...(data.checkIn && { checkIn: checkInDate }),
          ...(data.checkOut && { checkOut: checkOutDate }),
          ...(roomChanged && { roomId: newRoomId }),
          ...(data.numberOfGuests !== undefined && { numberOfGuests }),
          ...(data.notes !== undefined && { notes: data.notes }),
          totalPrice,
          discountRuleId: manualRuleId,
          discountAmount,
          autoDiscountRuleId,
          autoDiscountAmount,
        },
        include: {
          room: { select: { id: true, number: true, type: true } },
        },
      });

      // Cascade to the linked invoice (open invoices only)
      const openInvoice = existing.invoices.find((i: any) => !['PAID', 'CANCELLED'].includes(i.status));
      if (openInvoice) {
        // Replace invoice items with a single re-priced line, mirror discount
        await tx.invoiceItem.deleteMany({ where: { invoiceId: openInvoice.id } });
        await tx.invoiceItem.create({
          data: {
            invoiceId: openInvoice.id,
            description: `Chambre ${updated.room.number} (${updated.room.type}) — ${nights} nuit${nights > 1 ? 's' : ''}`,
            quantity: nights,
            unitPrice: Number(room.pricePerNight),
            totalPrice: subtotal,
          },
        });
        await tx.invoice.update({
          where: { id: openInvoice.id },
          data: {
            subtotal,
            taxAmount: 0,
            taxRate: 0,
            totalAmount: totalPrice,
            discountRuleId: manualRuleId,
            discountAmount,
            autoDiscountRuleId,
            autoDiscountAmount,
            notes: `Hébergement ${updated.guestName} — Chambre ${updated.room.number} (${nights} nuit${nights > 1 ? 's' : ''})`,
          },
        });
      }

      logger.info('Reservation updated', {
        tenantId, id,
        datesChanged, roomChanged,
        nights, subtotal, discountAmount, totalPrice,
      });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Check-in a reservation.
   */
  async checkIn(tenantId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id, tenantId },
      });

      if (!reservation) throw new NotFoundError('Réservation');

      if (reservation.status !== 'CONFIRMED') {
        throw new ValidationError(`Check-in impossible : statut actuel = ${reservation.status}`);
      }

      // Update room status to OCCUPIED
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: 'OCCUPIED' },
      });

      return tx.reservation.update({
        where: { id },
        data: { status: 'CHECKED_IN' },
      });
    });
  }

  /**
   * Check-out a reservation.
   */
  async checkOut(tenantId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id, tenantId },
      });

      if (!reservation) throw new NotFoundError('Réservation');

      if (reservation.status !== 'CHECKED_IN') {
        throw new ValidationError(`Check-out impossible : statut actuel = ${reservation.status}`);
      }

      // Update room status to AVAILABLE
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: 'AVAILABLE' },
      });

      return tx.reservation.update({
        where: { id },
        data: { status: 'CHECKED_OUT' },
      });
    });
  }

  /**
   * Cancel a reservation.
   */
  async cancel(tenantId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id, tenantId },
      });

      if (!reservation) throw new NotFoundError('Réservation');

      if (['CHECKED_OUT', 'CANCELLED'].includes(reservation.status)) {
        throw new ValidationError('Réservation déjà terminée ou annulée');
      }

      // Release room if checked-in
      if (reservation.status === 'CHECKED_IN') {
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'AVAILABLE' },
        });
      }

      return tx.reservation.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    });
  }

  /**
   * Backfill invoices + payments for channel-imported reservations that were
   * created before the channel-sync fix landed. Idempotent — only processes
   * reservations where no invoice exists yet. Per-reservation errors are
   * collected and returned without aborting the whole run.
   */
  async backfillChannelInvoices(tenantId: string): Promise<{
    scanned: number;
    invoicesCreated: number;
    paymentsCreated: number;
    skipped: number;
    errors: Array<{ reservationId: string; error: string }>;
  }> {
    const errors: Array<{ reservationId: string; error: string }> = [];
    let invoicesCreated = 0;
    let paymentsCreated = 0;
    let skipped = 0;

    // Find channel reservations without an invoice
    const candidates = await prisma.reservation.findMany({
      where: {
        tenantId,
        source: { in: ['BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'CHANNEL_MANAGER'] },
        status: { not: 'CANCELLED' },
        invoices: { none: {} },
      },
      include: {
        room: { select: { id: true, number: true, type: true, pricePerNight: true, establishmentId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const scanned = candidates.length;

    // Pick a system user once
    const systemUser = await prisma.user.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!systemUser) {
      throw new ValidationError('Aucun utilisateur système actif pour émettre les factures');
    }

    for (const r of candidates) {
      try {
        const nights = calculateNights(r.checkIn, r.checkOut);
        const subtotal = Number(r.room.pricePerNight.mul(nights));
        const totalAmount = Number(r.totalPrice) || subtotal;
        const paymentMethod = r.source === 'CHANNEL_MANAGER' ? 'FEDAPAY' : 'OTHER';

        // Find or create the client from guest info
        const { clientService } = await import('./client.service');
        const [firstName, ...rest] = (r.guestName || 'Client').trim().split(/\s+/);
        const client = await clientService.findOrCreate(tenantId, {
          firstName: firstName || r.guestName || 'Client',
          lastName: rest.join(' '),
          email: r.guestEmail ?? undefined,
          phone: r.guestPhone ?? undefined,
          source: r.source,
        });

        await prisma.$transaction(async (tx) => {
          // Generate a unique invoice number based on the reservation creation day
          const day = r.createdAt.toISOString().slice(0, 10).replace(/-/g, '');
          const todayStart = new Date(r.createdAt.toISOString().slice(0, 10));
          const tomorrowStart = new Date(todayStart);
          tomorrowStart.setDate(tomorrowStart.getDate() + 1);
          const lastInvoice = await tx.invoice.findFirst({
            where: { tenantId, createdAt: { gte: todayStart, lt: tomorrowStart } },
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true },
          });
          const lastNum = lastInvoice
            ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10)
            : 0;
          const invoiceNumber = `FAC-${day}-${String(lastNum + 1).padStart(4, '0')}`;

          const invoice = await tx.invoice.create({
            data: {
              tenantId,
              reservationId: r.id,
              clientId: client.id,
              createdById: systemUser.id,
              invoiceNumber,
              subtotal,
              taxAmount: 0,
              taxRate: 0,
              totalAmount,
              paymentMethod,
              notes: `Hébergement ${r.guestName} — Chambre ${r.room.number} (${nights} nuit${nights > 1 ? 's' : ''}) [${r.source}] (rattrapage)`,
              status: 'ISSUED',
              createdAt: r.createdAt,
              items: {
                create: [{
                  description: `Chambre ${r.room.number} (${r.room.type}) — ${nights} nuit${nights > 1 ? 's' : ''}`,
                  quantity: nights,
                  unitPrice: Number(r.room.pricePerNight),
                  totalPrice: subtotal,
                }],
              },
            },
          });
          invoicesCreated++;

          // Record the payment at the reservation's createdAt — the CA lands
          // on the day the reservation was originally confirmed.
          await tx.payment.create({
            data: {
              tenantId,
              invoiceId: invoice.id,
              amount: totalAmount,
              method: paymentMethod,
              reference: r.externalRef || `channel:${r.source}`,
              paidAt: r.createdAt,
              createdAt: r.createdAt,
            },
          });
          paymentsCreated++;

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID', paidAt: r.createdAt },
          });

          // Link the reservation to the client if it wasn't already
          if (!r.clientId) {
            await tx.reservation.update({
              where: { id: r.id },
              data: { clientId: client.id },
            });
          }
        });
      } catch (e: any) {
        errors.push({ reservationId: r.id, error: e?.message || 'Erreur inconnue' });
        skipped++;
      }
    }

    logger.info('Channel invoice backfill complete', {
      tenantId, scanned, invoicesCreated, paymentsCreated, skipped, errorCount: errors.length,
    });

    return { scanned, invoicesCreated, paymentsCreated, skipped, errors };
  }

  /**
   * Get room availability as JSON (occupied periods).
   */
  async getAvailability(tenantId: string, from?: string, to?: string, establishmentId?: string) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Limit window to 365 days
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      throw new ValidationError('Période maximale : 365 jours');
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId,
        ...(establishmentId && { room: { establishmentId } }),
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkIn: { lte: toDate },
        checkOut: { gte: fromDate },
      },
      select: {
        room: { select: { number: true } },
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: 'asc' },
    });

    return reservations.map((r) => ({
      room: r.room.number,
      start: r.checkIn.toISOString().split('T')[0],
      end: r.checkOut.toISOString().split('T')[0],
    }));
  }

  /**
   * Generate iCalendar feed (RFC 5545).
   */
  async getAvailabilityIcal(tenantId: string) {
    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkOut: { gte: new Date() },
      },
      include: { room: true },
      orderBy: { checkIn: 'asc' },
    });

    const { formatICalDate, formatICalDateTime, escapeICalText } = await import('../utils/helpers');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HotelPMS//Availability//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:Disponibilités Hotel PMS`,
    ];

    for (const r of reservations) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${r.id}@hotelpms.app`,
        `DTSTART;VALUE=DATE:${formatICalDate(r.checkIn)}`,
        `DTEND;VALUE=DATE:${formatICalDate(r.checkOut)}`,
        `SUMMARY:${escapeICalText(`Chambre ${r.room.number} - Occupée`)}`,
        `DESCRIPTION:${escapeICalText(`Réservation ${r.source}`)}`,
        `DTSTAMP:${formatICalDateTime(new Date())}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}

export const reservationService = new ReservationService();
