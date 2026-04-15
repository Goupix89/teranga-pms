import { OrderStatus, EstablishmentRole } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';
import { notificationService } from './notification.service';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

export class OrderService {
  /**
   * List orders with filters and pagination.
   */
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: {
      establishmentId?: string;
      status?: OrderStatus;
      createdById?: string;
      from?: string;
      to?: string;
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.createdById && { createdById: filters.createdById }),
      ...(filters.from && { createdAt: { gte: new Date(filters.from) } }),
      ...(filters.to && {
        createdAt: {
          ...((filters.from && { gte: new Date(filters.from) }) || {}),
          lte: new Date(filters.to),
        },
      }),
    };

    const [data, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: {
            include: {
              article: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        ...toSkipTake(params),
      }),
      db.order.count({ where }),
    ]);

    // Convert Decimal fields to numbers for JSON serialization
    const serialized = data.map((o: any) => ({
      ...o,
      totalAmount: Number(o.totalAmount),
      items: o.items?.map((i: any) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    }));

    return paginate(serialized, total, params);
  }

  /**
   * Get a single order by ID with full details.
   */
  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const order = await db.order.findFirst({
      where: { id },
      include: {
        items: {
          include: {
            article: { select: { id: true, name: true, sku: true, unitPrice: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        establishment: { select: { id: true, name: true } },
      },
    });

    if (!order) throw new NotFoundError('Commande');
    return order;
  }

  /**
   * Create a new order with items, auto-calculating totalAmount and orderNumber.
   */
  async create(
    tenantId: string,
    userId: string,
    data: {
      establishmentId: string;
      idempotencyKey?: string;
      tableNumber?: string;
      orderType?: string; // RESTAURANT | LEISURE | LOCATION
      items: Array<{ articleId: string; quantity: number }>;
      notes?: string;
      paymentMethod?: string;
      startTime?: string;
      endTime?: string;
      isVoucher?: boolean;
      voucherOwnerId?: string;
      voucherOwnerName?: string;
      discountRuleId?: string;
    }
  ) {
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('La commande doit contenir au moins un article');
    }

    // Idempotency: if key provided and order already exists, return it instead of creating a duplicate
    if (data.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: {
          items: { include: { article: { select: { id: true, name: true } } } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (existing) {
        return { ...existing, totalAmount: Number(existing.totalAmount) };
      }
    }

    // Retry loop to handle concurrent order number collisions
    for (let attempt = 0; attempt < 3; attempt++) {
    try {
    return await prisma.$transaction(async (tx) => {
      // Verify establishment belongs to tenant
      const establishment = await tx.establishment.findFirst({
        where: { id: data.establishmentId, tenantId },
      });
      if (!establishment) throw new NotFoundError('Établissement');

      // Fetch all articles and validate
      const articleIds = data.items.map((i) => i.articleId);
      const articles = await tx.article.findMany({
        where: { id: { in: articleIds }, tenantId, isActive: true },
      });

      if (articles.length !== articleIds.length) {
        throw new ValidationError('Un ou plusieurs articles sont introuvables ou inactifs');
      }

      const articleMap = new Map(articles.map((a) => [a.id, a]));

      // Calculate subtotal
      let subtotal = 0;
      const itemsData = data.items.map((item) => {
        const article = articleMap.get(item.articleId)!;
        const unitPrice = article.unitPrice.toNumber();
        subtotal += unitPrice * item.quantity;
        return {
          articleId: item.articleId,
          quantity: item.quantity,
          unitPrice,
        };
      });

      // Apply manual discount rule if provided (orders only accept manual discounts)
      let discountRuleId: string | null = null;
      let discountAmount = 0;
      if (data.discountRuleId && !data.isVoucher) {
        const { discountService } = await import('./discount.service');
        const applied = await discountService.apply(tenantId, data.discountRuleId, {
          subtotal, appliesTo: 'ORDER',
        });
        discountRuleId = applied.rule.id || null;
        discountAmount = applied.amount;
      }
      const totalAmount = Math.max(0, subtotal - discountAmount);

      // Generate order number: CMD-YYYYMMDD-NNNN
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      // Use MAX-based numbering to avoid race conditions
      const lastOrder = await tx.order.findFirst({
        where: {
          tenantId,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      const lastNum = lastOrder
        ? parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10)
        : 0;
      const orderNumber = `CMD-${dateStr}-${String(lastNum + 1).padStart(4, '0')}`;

      // Create order with items
      const order = await tx.order.create({
        data: {
          tenantId,
          establishmentId: data.establishmentId,
          createdById: userId,
          orderNumber,
          idempotencyKey: data.idempotencyKey || null,
          orderType: data.orderType || 'RESTAURANT',
          isVoucher: data.isVoucher || false,
          voucherOwnerId: data.isVoucher ? (data.voucherOwnerId || null) : null,
          voucherOwnerName: data.isVoucher ? (data.voucherOwnerName || null) : null,
          tableNumber: data.tableNumber,
          paymentMethod: data.paymentMethod as any,
          notes: data.notes,
          totalAmount,
          discountRuleId,
          discountAmount,
          startTime: data.startTime ? new Date(data.startTime) : null,
          endTime: data.endTime ? new Date(data.endTime) : null,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: {
            include: {
              article: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Auto-generate invoice for the order — use global invoice counter
      const invoiceDateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const lastInvoice = await tx.invoice.findFirst({
        where: { tenantId, invoiceNumber: { startsWith: `FAC-${invoiceDateStr}` } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      const lastInvNum = lastInvoice
        ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10)
        : 0;
      const invoiceNumber = `FAC-${invoiceDateStr}-${String(lastInvNum + 1).padStart(4, '0')}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          createdById: userId,
          invoiceNumber,
          subtotal,
          taxAmount: 0,
          taxRate: 0,
          discountRuleId,
          discountAmount,
          totalAmount,
          paymentMethod: data.paymentMethod as any || null,
          notes: `${data.isVoucher ? `[BON PROPRIÉTAIRE${data.voucherOwnerName ? ` — ${data.voucherOwnerName}` : ''}] ` : ''}Commande ${orderNumber}${data.tableNumber ? ` - Table ${data.tableNumber}` : ''}`,
          isVoucher: data.isVoucher || false,
          voucherOwnerName: data.isVoucher ? (data.voucherOwnerName || null) : null,
          status: 'ISSUED',
          items: {
            create: itemsData.map((item) => {
              const article = articleMap.get(item.articleId)!;
              return {
                articleId: item.articleId,
                description: article.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.unitPrice * item.quantity,
              };
            }),
          },
        },
      });

      // Link order to invoice
      await tx.order.update({
        where: { id: order.id },
        data: { invoiceId: invoice.id },
      });

      // Notify cooks about new order
      notificationService.notifyRole({
        tenantId,
        establishmentId: data.establishmentId,
        roles: ['COOK'],
        type: 'ORDER_NEW',
        title: 'Nouvelle commande',
        message: `Commande ${orderNumber}${data.tableNumber ? ` (Table ${data.tableNumber})` : ''} — ${data.items.length} article(s).`,
        data: { orderId: order.id, orderNumber, tableNumber: data.tableNumber },
      }).catch(() => {});

      // Voucher orders require Owner approval
      let requiresApproval = false;
      if (data.isVoucher && data.voucherOwnerId) {
        requiresApproval = true;
        await tx.approvalRequest.create({
          data: {
            tenantId,
            establishmentId: data.establishmentId,
            type: 'VOUCHER_ORDER',
            requestedById: userId,
            targetId: order.id,
            payload: {
              orderId: order.id,
              orderNumber,
              totalAmount,
              voucherOwnerId: data.voucherOwnerId,
              voucherOwnerName: data.voucherOwnerName,
              tableNumber: data.tableNumber,
              items: itemsData.map((i) => ({
                articleId: i.articleId,
                name: articleMap.get(i.articleId)?.name,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              })),
            },
          },
        });

        // Notify the specific Owner
        notificationService.notify({
          tenantId,
          userId: data.voucherOwnerId,
          establishmentId: data.establishmentId,
          type: 'APPROVAL_NEEDED',
          title: 'Bon Propriétaire — Approbation requise',
          message: `${order.createdBy.firstName} ${order.createdBy.lastName} demande un bon de ${formatCurrency(totalAmount)} (${orderNumber}).`,
          data: { orderId: order.id, orderNumber, approvalType: 'VOUCHER_ORDER' },
        }).catch(() => {});
      }

      return { ...order, invoiceId: invoice.id, requiresApproval };
    });
    } catch (err: any) {
      // Retry on unique constraint violation (P2002)
      if (err?.code === 'P2002' && attempt < 2) continue;
      throw err;
    }
    }
    throw new Error('Failed to create order after retries');
  }

  /**
   * Update order status with validation of transitions and role checks.
   */
  async updateStatus(tenantId: string, id: string, status: OrderStatus, userId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
      });

      if (!order) throw new NotFoundError('Commande');

      // Validate status transitions
      const validTransitions: Record<OrderStatus, OrderStatus[]> = {
        PENDING: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['READY', 'CANCELLED'],
        READY: ['SERVED'],
        SERVED: [],
        CANCELLED: [],
      };

      if (!validTransitions[order.status]?.includes(status)) {
        throw new ValidationError(
          `Transition de statut invalide : ${order.status} → ${status}`
        );
      }

      // Check role-based restrictions on status changes
      const membership = await tx.establishmentMember.findFirst({
        where: { userId, establishmentId: order.establishmentId, isActive: true },
      });

      const role = membership?.role;

      if (role === 'COOK') {
        if (!['IN_PROGRESS', 'READY'].includes(status)) {
          throw new ForbiddenError('Un cuisinier ne peut définir que les statuts EN_COURS et PRÊT');
        }
      }

      if (role === 'SERVER') {
        if (status !== 'SERVED') {
          throw new ForbiddenError('Un serveur ne peut définir que le statut SERVI');
        }
      }

      if (role === 'MANAGER' || role === 'DAF') {
        if (['IN_PROGRESS', 'READY'].includes(status)) {
          throw new ForbiddenError('Seul un cuisinier peut changer le statut en EN_COURS ou PRÊT');
        }
        if (status === 'SERVED') {
          throw new ForbiddenError('Seul un serveur peut définir le statut SERVI');
        }
        // MANAGER and DAF can only set CANCELLED
        if (status !== 'CANCELLED') {
          throw new ForbiddenError('Un gestionnaire ne peut qu\'annuler les commandes');
        }
      }

      // Set timestamps based on status
      const updateData: any = { status };
      if (status === 'READY') {
        updateData.readyAt = new Date();
      } else if (status === 'SERVED') {
        updateData.servedAt = new Date();
      }

      const updated = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          items: {
            include: {
              article: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Cancel the associated invoice when an order is cancelled
      if (status === 'CANCELLED' && order.invoiceId) {
        await tx.invoice.update({
          where: { id: order.invoiceId },
          data: { status: 'CANCELLED' },
        });
      }

      // Notify on every status change so all roles see updates in real-time
      const statusLabels: Record<string, string> = {
        IN_PROGRESS: 'en preparation',
        READY: 'prete a servir',
        SERVED: 'servie',
        CANCELLED: 'annulee',
      };

      // Notify the creator (SERVER/POS) on status changes
      if (order.createdById && order.createdById !== userId) {
        notificationService.notify({
          tenantId,
          userId: order.createdById,
          establishmentId: order.establishmentId,
          type: `ORDER_${status}`,
          title: `Commande ${statusLabels[status] || status}`,
          message: `La commande ${order.orderNumber} est ${statusLabels[status] || status}.`,
          data: { orderId: order.id, orderNumber: order.orderNumber, status },
        }).catch(() => {});
      }

      // Notify cooks when a new order arrives or status changes
      if (['CANCELLED', 'SERVED'].includes(status)) {
        notificationService.notifyRole({
          tenantId,
          establishmentId: order.establishmentId,
          roles: ['COOK'],
          type: `ORDER_${status}`,
          title: `Commande ${statusLabels[status] || status}`,
          message: `La commande ${order.orderNumber} est ${statusLabels[status] || status}.`,
          data: { orderId: order.id, orderNumber: order.orderNumber, status },
        }).catch(() => {});
      }

      // Notify servers when order is READY
      if (status === 'READY') {
        notificationService.notifyRole({
          tenantId,
          establishmentId: order.establishmentId,
          roles: ['SERVER', 'POS', 'MAITRE_HOTEL'],
          type: 'ORDER_READY',
          title: 'Commande prete',
          message: `La commande ${order.orderNumber} est prete a servir.`,
          data: { orderId: order.id, orderNumber: order.orderNumber, status },
        }).catch(() => {});
      }

      return updated;
    });
  }

  /**
   * Get kitchen orders (PENDING or IN_PROGRESS), ordered by creation time.
   */
  async getKitchenOrders(tenantId: string, establishmentId: string) {
    const db = createTenantClient(tenantId);

    return db.order.findMany({
      where: {
        establishmentId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        items: {
          include: {
            article: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get order statistics: today, this week, this month counts.
   */
  async getStats(tenantId: string, establishmentId: string, userId?: string) {
    const db = createTenantClient(tenantId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of week (Monday)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - diffToMonday);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseWhere: any = {
      establishmentId,
      ...(userId && { createdById: userId }),
    };

    const [today, thisWeek, thisMonth] = await Promise.all([
      db.order.count({
        where: { ...baseWhere, createdAt: { gte: todayStart } },
      }),
      db.order.count({
        where: { ...baseWhere, createdAt: { gte: weekStart } },
      }),
      db.order.count({
        where: { ...baseWhere, createdAt: { gte: monthStart } },
      }),
    ]);

    return { today, thisWeek, thisMonth };
  }

  /**
   * Detect duplicate orders: same creator, same items (articles+quantities),
   * same totalAmount, created within 2 minutes of each other.
   */
  async findDuplicates(tenantId: string, establishmentId?: string) {
    const db = createTenantClient(tenantId);

    const where: any = {
      status: { notIn: ['CANCELLED'] },
      ...(establishmentId && { establishmentId }),
    };

    const orders = await db.order.findMany({
      where,
      include: {
        items: { select: { articleId: true, quantity: true }, orderBy: { articleId: 'asc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by creator + items fingerprint
    const groups = new Map<string, typeof orders>();
    for (const order of orders) {
      const itemsFingerprint = order.items
        .map((i: any) => `${i.articleId}:${i.quantity}`)
        .join('|');
      const key = `${order.createdById}__${itemsFingerprint}__${Number(order.totalAmount)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(order);
    }

    // Within each group, find orders created within 2 minutes of each other
    const duplicateGroups: Array<{
      original: any;
      duplicates: any[];
      totalDuplicateAmount: number;
    }> = [];

    for (const [, group] of groups) {
      if (group.length < 2) continue;

      // Sort by createdAt, then cluster by 2-minute windows
      const sorted = group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      let i = 0;
      while (i < sorted.length) {
        const cluster = [sorted[i]];
        let j = i + 1;
        while (j < sorted.length) {
          const diff = sorted[j].createdAt.getTime() - sorted[j - 1].createdAt.getTime();
          if (diff <= 120_000) { // 2 minutes
            cluster.push(sorted[j]);
            j++;
          } else break;
        }

        if (cluster.length > 1) {
          const [original, ...dupes] = cluster;
          duplicateGroups.push({
            original: {
              id: original.id,
              orderNumber: original.orderNumber,
              totalAmount: Number(original.totalAmount),
              status: original.status,
              createdAt: original.createdAt,
              createdBy: original.createdBy,
              tableNumber: original.tableNumber,
              itemCount: original.items.length,
            },
            duplicates: dupes.map((d) => ({
              id: d.id,
              orderNumber: d.orderNumber,
              totalAmount: Number(d.totalAmount),
              status: d.status,
              createdAt: d.createdAt,
              invoiceId: d.invoiceId,
            })),
            totalDuplicateAmount: dupes.reduce((sum, d) => sum + Number(d.totalAmount), 0),
          });
        }
        i = j;
      }
    }

    const totalDuplicateOrders = duplicateGroups.reduce((s, g) => s + g.duplicates.length, 0);
    const totalDuplicateAmount = duplicateGroups.reduce((s, g) => s + g.totalDuplicateAmount, 0);

    return {
      duplicateGroups,
      summary: {
        totalGroups: duplicateGroups.length,
        totalDuplicateOrders,
        totalDuplicateAmount,
      },
    };
  }

  /**
   * Cancel duplicate orders and their invoices — keeps the original, cancels the rest.
   * Safe: does not delete anything, only sets status to CANCELLED.
   */
  async cancelDuplicates(tenantId: string, duplicateOrderIds: string[]) {
    if (duplicateOrderIds.length === 0) return { cancelled: 0 };

    const db = createTenantClient(tenantId);

    // Verify all orders exist and are not already cancelled
    const orders = await db.order.findMany({
      where: { id: { in: duplicateOrderIds }, status: { not: 'CANCELLED' } },
      select: { id: true, invoiceId: true, orderNumber: true },
    });

    const cancelled: string[] = [];

    for (const order of orders) {
      await prisma.$transaction(async (tx) => {
        // Cancel the order
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', notes: '[AUTO] Doublon annulé' },
        });

        // Cancel the linked invoice
        if (order.invoiceId) {
          await tx.invoice.update({
            where: { id: order.invoiceId },
            data: { status: 'CANCELLED', notes: `[AUTO] Facture annulée — doublon de commande ${order.orderNumber}` },
          });
        }
      });

      cancelled.push(order.id);
    }

    return {
      cancelled: cancelled.length,
      cancelledOrderIds: cancelled,
    };
  }
}

export const orderService = new OrderService();
