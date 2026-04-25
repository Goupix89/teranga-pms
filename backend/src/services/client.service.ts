import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';

export class ClientService {
  async list(tenantId: string, params: PaginationParams, search?: string) {
    const db = createTenantClient(tenantId);
    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.client.findMany({
        where,
        include: {
          _count: { select: { reservations: true, invoices: true } },
        },
        ...toSkipTake(params),
      }),
      db.client.count({ where }),
    ]);

    const clientIds = data.map((c) => c.id);
    const revenueByClient: Record<string, number> = {};
    if (clientIds.length) {
      const revenue = await db.payment.groupBy({
        by: ['invoiceId'],
        _sum: { amount: true },
      });
      const invoices = await db.invoice.findMany({
        where: { clientId: { in: clientIds }, status: 'PAID' },
        select: { id: true, clientId: true },
      });
      const invoiceToClient: Record<string, string> = {};
      invoices.forEach((i) => { if (i.clientId) invoiceToClient[i.id] = i.clientId; });
      revenue.forEach((r) => {
        const cid = invoiceToClient[r.invoiceId];
        if (cid) revenueByClient[cid] = (revenueByClient[cid] || 0) + Number(r._sum.amount || 0);
      });
    }

    const serialized = data.map((c: any) => ({
      ...c,
      reservationCount: c._count.reservations,
      invoiceCount: c._count.invoices,
      totalRevenue: revenueByClient[c.id] || 0,
    }));

    return paginate(serialized, total, params);
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);
    const client = await db.client.findFirst({
      where: { id },
      include: {
        reservations: {
          include: { room: { select: { number: true, type: true } } },
          orderBy: { checkIn: 'desc' },
        },
        invoices: {
          include: { payments: true, orders: { select: { id: true, totalAmount: true, createdAt: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!client) throw new NotFoundError('Client');

    const totalRevenue = client.invoices
      .filter((i: any) => i.status === 'PAID')
      .reduce((sum: number, i: any) => sum + i.payments.reduce((s: number, p: any) => s + Number(p.amount), 0), 0);
    const totalStays = client.reservations.filter((r: any) => r.status === 'CHECKED_OUT').length;
    const lastVisit = client.reservations[0]?.checkOut || null;

    // Count paid reservations (invoices with status PAID linked to a reservation)
    const paidReservations = client.invoices.filter(
      (i: any) => i.status === 'PAID' && i.reservationId
    ).length;

    return {
      ...client,
      stats: {
        totalRevenue,
        totalStays,
        totalReservations: client.reservations.length,
        totalInvoices: client.invoices.length,
        paidReservations,
        lastVisit,
        isFidele: paidReservations >= 5,
        fidelityTier: paidReservations >= 5 ? 'FIDELE' : 'NEW',
      },
    };
  }

  /**
   * Find or create a client by email (preferred) or phone.
   * Safe to call from webhooks (FedaPay, channel manager, etc).
   */
  async findOrCreate(tenantId: string, data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    source?: string;
  }) {
    if (data.email) {
      const existing = await prisma.client.findFirst({
        where: { tenantId, email: data.email },
      });
      if (existing) {
        return prisma.client.update({
          where: { id: existing.id },
          data: {
            firstName: data.firstName || existing.firstName,
            lastName: data.lastName || existing.lastName,
            phone: data.phone || existing.phone,
          },
        });
      }
    }
    if (data.phone) {
      const existing = await prisma.client.findFirst({
        where: { tenantId, phone: data.phone },
      });
      if (existing) return existing;
    }
    // Fallback: when neither email nor phone is provided, try to match an
    // existing nameless client by exact firstName + lastName to avoid creating
    // a fresh row for the same anonymous guest on every reservation.
    if (!data.email && !data.phone && (data.firstName || data.lastName)) {
      const existing = await prisma.client.findFirst({
        where: {
          tenantId,
          email: null,
          phone: null,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
        },
      });
      if (existing) return existing;
    }
    return prisma.client.create({
      data: {
        tenantId,
        firstName: data.firstName || 'Client',
        lastName: data.lastName || '',
        email: data.email,
        phone: data.phone,
        source: data.source || 'DIRECT',
      },
    });
  }

  async update(tenantId: string, id: string, data: {
    firstName?: string; lastName?: string; email?: string; phone?: string; notes?: string; tags?: any;
  }) {
    const client = await prisma.client.findFirst({ where: { id, tenantId } });
    if (!client) throw new NotFoundError('Client');
    return prisma.client.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const client = await prisma.client.findFirst({ where: { id, tenantId } });
    if (!client) throw new NotFoundError('Client');
    return prisma.client.delete({ where: { id } });
  }
}

export const clientService = new ClientService();
