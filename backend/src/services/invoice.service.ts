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

  /**
   * Merge multiple invoices into one consolidated invoice.
   * All source invoices must be ISSUED and unpaid. Their items and linked orders
   * are moved to a new invoice, and the sources are cancelled.
   */
  async merge(tenantId: string, createdById: string, invoiceIds: string[], tableNumber?: string) {
    if (invoiceIds.length < 2) {
      throw new ValidationError('Au moins 2 factures sont requises pour le regroupement');
    }

    return prisma.$transaction(async (tx) => {
      // Load all source invoices with items, orders, and payments
      const invoices = await tx.invoice.findMany({
        where: { id: { in: invoiceIds }, tenantId },
        include: {
          items: true,
          orders: { select: { id: true, orderNumber: true, tableNumber: true } },
          payments: { take: 1 },
        },
      });

      if (invoices.length !== invoiceIds.length) {
        throw new NotFoundError('Une ou plusieurs factures introuvables');
      }

      // Validate: all must be ISSUED or DRAFT, and have no payments
      for (const inv of invoices) {
        if (!['ISSUED', 'DRAFT'].includes(inv.status)) {
          throw new ValidationError(`La facture ${inv.invoiceNumber} ne peut pas être regroupée (statut: ${inv.status})`);
        }
        if (inv.payments.length > 0) {
          throw new ValidationError(`La facture ${inv.invoiceNumber} a déjà des paiements`);
        }
      }

      // Generate new invoice number
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const lastInvoice = await tx.invoice.findFirst({
        where: { tenantId, invoiceNumber: { startsWith: `FAC-${dateStr}` } },
        orderBy: { invoiceNumber: 'desc' },
      });
      const lastNum = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10) : 0;
      const invoiceNumber = `FAC-${dateStr}-${String(lastNum + 1).padStart(4, '0')}`;

      // Collect all items — convert Prisma Decimals to numbers
      // If an invoice has no items (legacy orders), pull items from linked orders instead
      let allItems: Array<{ articleId: string | null; description: string; quantity: number; unitPrice: number; totalPrice: number }> = [];

      for (const inv of invoices) {
        if (inv.items.length > 0) {
          // Invoice has its own items — use them
          allItems.push(...inv.items.map((item) => ({
            articleId: item.articleId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.unitPrice) * item.quantity,
          })));
        } else if (inv.orders.length > 0) {
          // No invoice items — pull from linked orders
          const orderIds = inv.orders.map((o) => o.id);
          const orderItems = await tx.orderItem.findMany({
            where: { orderId: { in: orderIds } },
            include: { article: { select: { id: true, name: true } } },
          });
          allItems.push(...orderItems.map((oi) => ({
            articleId: oi.articleId,
            description: oi.article?.name || 'Article',
            quantity: oi.quantity,
            unitPrice: Number(oi.unitPrice),
            totalPrice: Number(oi.unitPrice) * oi.quantity,
          })));
        }
      }

      // If still no items found, use the invoice totalAmounts directly as a fallback
      let subtotal: number;
      let totalAmount: number;
      if (allItems.length > 0) {
        subtotal = allItems.reduce((sum, i) => sum + i.totalPrice, 0);
        totalAmount = subtotal;
      } else {
        subtotal = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        totalAmount = subtotal;
      }

      // Build notes: concatenate all source descriptions + invoice numbers
      const sourceNumbers = invoices.map((inv) => inv.invoiceNumber).join(', ');
      const sourceNotes = invoices
        .map((inv) => inv.notes)
        .filter(Boolean)
        .join(' | ');
      const notes = `Regroupement: ${sourceNumbers}${tableNumber ? ` — Table ${tableNumber}` : ''}${sourceNotes ? `\n${sourceNotes}` : ''}`;

      // Create consolidated invoice
      const merged = await tx.invoice.create({
        data: {
          tenantId,
          createdById,
          invoiceNumber,
          subtotal,
          taxRate: 0,
          taxAmount: 0,
          totalAmount,
          currency: invoices[0].currency,
          paymentMethod: invoices[0].paymentMethod,
          notes,
          status: 'ISSUED',
          items: {
            create: allItems.map((item) => ({
              articleId: item.articleId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: { items: true },
      });

      // Relink all orders to the new invoice
      const allOrderIds = invoices.flatMap((inv) => inv.orders.map((o) => o.id));
      if (allOrderIds.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: allOrderIds } },
          data: { invoiceId: merged.id },
        });
      }

      // Mark source invoices as MERGED (not cancelled) and keep their items for traceability
      for (const inv of invoices) {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { status: 'MERGED', notes: `Fusionnée dans ${invoiceNumber}` },
        });
      }

      logger.info('Invoices merged', {
        tenantId,
        sourceIds: invoiceIds,
        mergedInvoiceId: merged.id,
        invoiceNumber,
        totalAmount,
      });

      return {
        ...merged,
        subtotal: Number(merged.subtotal),
        taxRate: Number(merged.taxRate),
        taxAmount: Number(merged.taxAmount),
        totalAmount: Number(merged.totalAmount),
        orderCount: allOrderIds.length,
        sourceInvoices: sourceNumbers,
      };
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
