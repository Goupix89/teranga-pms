import { OrderStatus, EstablishmentRole } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';

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
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(params),
      }),
      db.order.count({ where }),
    ]);

    return paginate(data, total, params);
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
      tableNumber?: string;
      items: Array<{ articleId: string; quantity: number }>;
      notes?: string;
      paymentMethod?: string;
    }
  ) {
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('La commande doit contenir au moins un article');
    }

    return prisma.$transaction(async (tx) => {
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

      // Calculate total amount
      let totalAmount = 0;
      const itemsData = data.items.map((item) => {
        const article = articleMap.get(item.articleId)!;
        const unitPrice = article.unitPrice.toNumber();
        totalAmount += unitPrice * item.quantity;
        return {
          articleId: item.articleId,
          quantity: item.quantity,
          unitPrice,
        };
      });

      // Generate order number: CMD-YYYYMMDD-NNNN
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const todayCount = await tx.order.count({
        where: {
          tenantId,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      });

      const orderNumber = `CMD-${dateStr}-${String(todayCount + 1).padStart(4, '0')}`;

      // Create order with items
      const order = await tx.order.create({
        data: {
          tenantId,
          establishmentId: data.establishmentId,
          createdById: userId,
          orderNumber,
          tableNumber: data.tableNumber,
          paymentMethod: data.paymentMethod as any,
          notes: data.notes,
          totalAmount,
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

      // Auto-generate invoice for the order
      const orderSuffix = orderNumber.replace('CMD-', '');
      const invoiceNumber = `FAC-${orderSuffix}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          createdById: userId,
          invoiceNumber,
          subtotal: totalAmount,
          taxAmount: 0,
          taxRate: 0,
          totalAmount,
          notes: `Commande ${orderNumber}${data.tableNumber ? ` - Table ${data.tableNumber}` : ''}`,
          status: 'ISSUED',
        },
      });

      // Link order to invoice
      await tx.order.update({
        where: { id: order.id },
        data: { invoiceId: invoice.id },
      });

      return { ...order, invoiceId: invoice.id };
    });
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

      return tx.order.update({
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
}

export const orderService = new OrderService();
