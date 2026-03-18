import { Prisma, InvoiceStatus } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { paginate, toSkipTake, generateInvoiceNumber } from '../utils/helpers';
import { PaginationParams } from '../types';
import { logger } from '../utils/logger';

export class InvoiceService {
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: { status?: InvoiceStatus; reservationId?: string; search?: string; establishmentIds?: string[] } = {}
  ) {
    const db = createTenantClient(tenantId);

    const conditions: Prisma.InvoiceWhereInput[] = [];
    if (filters.status) conditions.push({ status: filters.status });
    if (filters.reservationId) conditions.push({ reservationId: filters.reservationId });
    if (filters.establishmentIds) {
      conditions.push({
        OR: [
          { reservation: { room: { establishmentId: { in: filters.establishmentIds } } } },
          { orders: { some: { establishmentId: { in: filters.establishmentIds } } } },
          { reservationId: null, orders: { none: {} } },
        ],
      });
    }
    if (filters.search) {
      conditions.push({
        OR: [
          { invoiceNumber: { contains: filters.search, mode: 'insensitive' as const } },
          { reservation: { guestName: { contains: filters.search, mode: 'insensitive' as const } } },
        ],
      });
    }
    const where: Prisma.InvoiceWhereInput = conditions.length > 0 ? { AND: conditions } : {};

    const [data, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          reservation: { select: { id: true, guestName: true, room: { select: { number: true } } } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          orders: { select: { id: true, orderNumber: true, establishmentId: true } },
          _count: { select: { payments: true, items: true } },
        },
        ...toSkipTake(params),
      }),
      db.invoice.count({ where }),
    ]);

    // Convert Decimal fields to numbers for JSON serialization
    const serialized = data.map((inv: any) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      taxRate: Number(inv.taxRate),
      taxAmount: Number(inv.taxAmount),
      totalAmount: Number(inv.totalAmount),
    }));

    return paginate(serialized, total, params);
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const invoice = await db.invoice.findFirst({
      where: { id },
      include: {
        items: {
          include: { article: { select: { id: true, name: true, sku: true } } },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
        reservation: {
          select: { id: true, guestName: true, guestEmail: true, checkIn: true, checkOut: true, room: { select: { number: true } } },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!invoice) throw new NotFoundError('Facture');
    return invoice;
  }

  async create(tenantId: string, createdById: string, data: {
    reservationId?: string;
    items: Array<{
      articleId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
    taxRate?: number;
    currency?: string;
    dueDate?: string;
    notes?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // Generate sequential invoice number
      const count = await tx.invoice.count({ where: { tenantId } });
      const invoiceNumber = generateInvoiceNumber(count + 1);

      // Calculate totals
      const items = data.items.map((item) => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice,
      }));

      const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
      const taxRate = data.taxRate ?? 0;
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Verify reservation belongs to tenant if provided
      if (data.reservationId) {
        const res = await tx.reservation.findFirst({
          where: { id: data.reservationId, tenantId },
        });
        if (!res) throw new NotFoundError('Réservation');
      }

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          createdById,
          invoiceNumber,
          reservationId: data.reservationId,
          subtotal,
          taxRate,
          taxAmount,
          totalAmount,
          currency: data.currency || 'XOF',
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          notes: data.notes,
          items: {
            create: items.map((item) => ({
              articleId: item.articleId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: {
          items: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      logger.info('Invoice created', {
        tenantId,
        invoiceId: invoice.id,
        invoiceNumber,
        totalAmount,
      });

      return invoice;
    });
  }

  async update(tenantId: string, id: string, data: {
    items?: Array<{
      id?: string;
      articleId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
    taxRate?: number;
    dueDate?: string | null;
    notes?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId },
      });

      if (!invoice) throw new NotFoundError('Facture');

      if (invoice.status !== 'DRAFT') {
        throw new ValidationError('Seules les factures en brouillon peuvent être modifiées');
      }

      let updateData: Prisma.InvoiceUpdateInput = {};

      if (data.items) {
        // Delete existing items and recreate
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        const items = data.items.map((item) => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice,
        }));

        const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
        const taxRate = data.taxRate ?? invoice.taxRate.toNumber();
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        updateData = {
          subtotal,
          taxRate,
          taxAmount,
          totalAmount,
          items: {
            create: items.map((item) => ({
              articleId: item.articleId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        };
      }

      if (data.taxRate !== undefined && !data.items) {
        const subtotal = invoice.subtotal.toNumber();
        const taxAmount = subtotal * (data.taxRate / 100);
        updateData.taxRate = data.taxRate;
        updateData.taxAmount = taxAmount;
        updateData.totalAmount = subtotal + taxAmount;
      }

      if (data.dueDate !== undefined) {
        updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      return tx.invoice.update({
        where: { id },
        data: updateData,
        include: { items: true },
      });
    });
  }

  async issue(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!invoice) throw new NotFoundError('Facture');

    if (invoice.status !== 'DRAFT') {
      throw new ValidationError('Seules les factures en brouillon peuvent être émises');
    }

    return prisma.invoice.update({
      where: { id },
      data: { status: 'ISSUED' },
    });
  }

  async cancel(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { payments: { take: 1 } },
    });

    if (!invoice) throw new NotFoundError('Facture');

    if (invoice.status === 'PAID') {
      throw new ValidationError('Impossible d\'annuler une facture payée');
    }

    if (invoice.payments.length > 0) {
      throw new ValidationError('Impossible d\'annuler une facture avec des paiements enregistrés');
    }

    return prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}

export const invoiceService = new InvoiceService();
