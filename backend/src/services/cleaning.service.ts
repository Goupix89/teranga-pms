import { CleaningStatus } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';

export class CleaningService {
  /**
   * List cleaning sessions with filters and pagination.
   */
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: {
      establishmentId?: string;
      cleanerId?: string;
      status?: CleaningStatus;
      roomId?: string;
      from?: string;
      to?: string;
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
      ...(filters.cleanerId && { cleanerId: filters.cleanerId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.roomId && { roomId: filters.roomId }),
      ...(filters.from && { createdAt: { gte: new Date(filters.from) } }),
      ...(filters.to && {
        createdAt: {
          ...((filters.from && { gte: new Date(filters.from) }) || {}),
          lte: new Date(filters.to),
        },
      }),
    };

    const [data, total] = await Promise.all([
      db.cleaningSession.findMany({
        where,
        include: {
          room: { select: { id: true, number: true } },
          cleaner: { select: { id: true, firstName: true, lastName: true } },
        },
        ...toSkipTake(params),
      }),
      db.cleaningSession.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  /**
   * Clock in: start a cleaning session for a room.
   */
  async clockIn(
    tenantId: string,
    data: {
      establishmentId: string;
      roomId: string;
      cleanerId: string;
      notes?: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // Verify room exists and belongs to tenant
      const room = await tx.room.findFirst({
        where: { id: data.roomId, tenantId },
      });
      if (!room) throw new NotFoundError('Chambre');

      // Check if room is already being cleaned
      const activeSession = await tx.cleaningSession.findFirst({
        where: {
          roomId: data.roomId,
          tenantId,
          status: 'IN_PROGRESS',
        },
      });

      if (activeSession) {
        throw new ValidationError('Cette chambre est déjà en cours de nettoyage');
      }

      // Set room status to CLEANING
      await tx.room.update({
        where: { id: data.roomId },
        data: { status: 'CLEANING' },
      });

      // Create cleaning session
      return tx.cleaningSession.create({
        data: {
          tenantId,
          establishmentId: data.establishmentId,
          roomId: data.roomId,
          cleanerId: data.cleanerId,
          notes: data.notes,
        },
        include: {
          room: { select: { id: true, number: true } },
          cleaner: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  /**
   * Clock out: end a cleaning session and set room back to AVAILABLE.
   */
  async clockOut(tenantId: string, sessionId: string, cleanerId: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.cleaningSession.findFirst({
        where: { id: sessionId, tenantId, status: 'IN_PROGRESS' },
      });

      if (!session) throw new NotFoundError('Session de nettoyage');

      // Only the assigned cleaner can clock out
      if (session.cleanerId !== cleanerId) {
        throw new ForbiddenError('Seul le nettoyeur assigné peut terminer cette session');
      }

      const now = new Date();
      const durationMinutes = Math.round(
        (now.getTime() - session.clockInAt.getTime()) / (1000 * 60)
      );

      // Set room status back to AVAILABLE
      await tx.room.update({
        where: { id: session.roomId },
        data: { status: 'AVAILABLE' },
      });

      // Complete the session
      return tx.cleaningSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          clockOutAt: now,
          durationMinutes,
        },
        include: {
          room: { select: { id: true, number: true } },
          cleaner: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  /**
   * Create a pending cleaning task from a checkout.
   * Sets the room status to CLEANING so cleaners see it on their dashboard.
   */
  async createFromCheckout(tenantId: string, roomId: string, establishmentId: string) {
    return prisma.room.update({
      where: { id: roomId },
      data: { status: 'CLEANING' },
    });
  }

  /**
   * Get active cleaning sessions for an establishment.
   */
  async getActiveSessions(tenantId: string, establishmentId: string) {
    const db = createTenantClient(tenantId);

    return db.cleaningSession.findMany({
      where: {
        establishmentId,
        status: 'IN_PROGRESS',
      },
      include: {
        room: { select: { id: true, number: true, floor: true } },
        cleaner: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { clockInAt: 'asc' },
    });
  }
}

export const cleaningService = new CleaningService();
