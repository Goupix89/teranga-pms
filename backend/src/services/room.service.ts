import { Prisma, RoomType, RoomStatus } from '@prisma/client';
import { createTenantClient, prisma } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';

export class RoomService {
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: {
      status?: RoomStatus;
      type?: RoomType;
      establishmentId?: string;
      establishmentIds?: string[];
      search?: string;
      minPrice?: number;
      maxPrice?: number;
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    // establishmentId (explicit filter) takes priority, otherwise use establishmentIds (user scope)
    const estFilter = filters.establishmentId
      ? { establishmentId: filters.establishmentId }
      : filters.establishmentIds
        ? { establishmentId: { in: filters.establishmentIds } }
        : {};

    const where: Prisma.RoomWhereInput = {
      isActive: true,
      ...(filters.status && { status: filters.status }),
      ...(filters.type && { type: filters.type }),
      ...estFilter,
      ...(filters.minPrice && { pricePerNight: { gte: filters.minPrice } }),
      ...(filters.maxPrice && { pricePerNight: { lte: filters.maxPrice } }),
      ...(filters.search && {
        OR: [
          { number: { contains: filters.search, mode: 'insensitive' as const } },
          { description: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      db.room.findMany({
        where,
        include: {
          establishment: { select: { id: true, name: true } },
          _count: { select: { reservations: true } },
        },
        ...toSkipTake(params),
      }),
      db.room.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const room = await db.room.findFirst({
      where: { id },
      include: {
        establishment: { select: { id: true, name: true, city: true } },
        reservations: {
          where: {
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
            checkOut: { gte: new Date() },
          },
          select: { id: true, guestName: true, checkIn: true, checkOut: true, status: true },
          orderBy: { checkIn: 'asc' },
          take: 10,
        },
      },
    });

    if (!room) throw new NotFoundError('Chambre');
    return room;
  }

  async create(tenantId: string, data: {
    establishmentId: string;
    number: string;
    floor?: number;
    type: RoomType;
    pricePerNight: number;
    maxOccupancy?: number;
    amenities?: string[];
    description?: string;
  }) {
    // Verify establishment belongs to tenant
    const establishment = await prisma.establishment.findFirst({
      where: { id: data.establishmentId, tenantId },
    });

    if (!establishment) throw new NotFoundError('Établissement');

    return prisma.room.create({
      data: {
        tenantId,
        establishmentId: data.establishmentId,
        number: data.number,
        floor: data.floor,
        type: data.type,
        pricePerNight: data.pricePerNight,
        maxOccupancy: data.maxOccupancy || 2,
        amenities: data.amenities || [],
        description: data.description,
      },
      include: {
        establishment: { select: { id: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: {
    number?: string;
    floor?: number | null;
    type?: RoomType;
    pricePerNight?: number;
    maxOccupancy?: number;
    amenities?: string[];
    description?: string | null;
    isActive?: boolean;
  }) {
    const room = await prisma.room.findFirst({ where: { id, tenantId } });
    if (!room) throw new NotFoundError('Chambre');

    return prisma.room.update({
      where: { id },
      data,
      include: {
        establishment: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(tenantId: string, id: string, status: RoomStatus) {
    const room = await prisma.room.findFirst({ where: { id, tenantId } });
    if (!room) throw new NotFoundError('Chambre');

    return prisma.room.update({
      where: { id },
      data: { status },
    });
  }

  async delete(tenantId: string, id: string) {
    const room = await prisma.room.findFirst({
      where: { id, tenantId },
      include: {
        reservations: {
          where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] } },
          take: 1,
        },
      },
    });

    if (!room) throw new NotFoundError('Chambre');

    if (room.reservations.length > 0) {
      throw new ValidationError('Impossible de supprimer une chambre avec des réservations actives');
    }

    // Soft delete
    return prisma.room.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const roomService = new RoomService();
