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
          invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true }, take: 1, orderBy: { createdAt: 'desc' as const } },
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
      const totalPrice = room.pricePerNight.mul(nights);

      // 5. Create reservation
      const reservation = await tx.reservation.create({
        data: {
          tenantId,
          roomId: data.roomId,
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
          notes: data.notes,
        },
        include: {
          room: { select: { number: true, type: true } },
        },
      });

      // 6. Auto-generate invoice for the reservation
      let invoiceId: string | undefined;
      if (userId) {
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

        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            reservationId: reservation.id,
            createdById: userId,
            invoiceNumber,
            subtotal: totalPrice,
            taxAmount: 0,
            taxRate: 0,
            totalAmount: totalPrice,
            paymentMethod: data.paymentMethod || null,
            notes: `Hébergement ${data.guestName} — Chambre ${reservation.room.number} (${nights} nuit${nights > 1 ? 's' : ''})`,
            status: 'ISSUED',
          },
        });
        invoiceId = invoice.id;
      }

      logger.info('Reservation created', {
        tenantId,
        reservationId: reservation.id,
        roomId: data.roomId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        source: data.source,
        invoiceId,
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
    numberOfGuests?: number;
    notes?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: { id, tenantId },
        include: { room: true },
      });

      if (!existing) throw new NotFoundError('Réservation');

      if (['CHECKED_OUT', 'CANCELLED'].includes(existing.status)) {
        throw new ValidationError('Impossible de modifier une réservation terminée ou annulée');
      }

      const checkInDate = data.checkIn ? new Date(data.checkIn) : existing.checkIn;
      const checkOutDate = data.checkOut ? new Date(data.checkOut) : existing.checkOut;

      // Re-check availability if dates changed
      if (data.checkIn || data.checkOut) {
        const conflict = await tx.reservation.findFirst({
          where: {
            tenantId,
            roomId: existing.roomId,
            id: { not: id },
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
            checkIn: { lt: checkOutDate },
            checkOut: { gt: checkInDate },
          },
        });

        if (conflict) {
          throw new ConflictError('Les nouvelles dates chevauchent une autre réservation');
        }
      }

      // Recalculate price if dates changed
      const nights = calculateNights(checkInDate, checkOutDate);
      const totalPrice = existing.room.pricePerNight.mul(nights);

      return tx.reservation.update({
        where: { id },
        data: {
          ...data,
          ...(data.checkIn && { checkIn: checkInDate }),
          ...(data.checkOut && { checkOut: checkOutDate }),
          totalPrice,
        },
        include: {
          room: { select: { number: true, type: true } },
        },
      });
    });
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
