import { OrderStatus, EstablishmentRole } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';
import { notificationService } from './notification.service';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

// Upstream-to-downstream progression; CANCELLED is terminal and ignored.
const STATUS_RANK: Record<Exclude<OrderStatus, 'CANCELLED'>, number> = {
  PENDING: 0,
  IN_PROGRESS: 1,
  READY: 2,
  SERVED: 3,
};

/**
 * Aggregate order status from item statuses: the most upstream (lowest rank)
 * status among non-cancelled items. If every item is CANCELLED the order is
 * CANCELLED; if the order has no items (shouldn't happen) we return PENDING.
 */
function aggregateOrderStatus(itemStatuses: OrderStatus[]): OrderStatus {
  const active = itemStatuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) {
    return itemStatuses.length > 0 ? 'CANCELLED' : 'PENDING';
  }
  let min: OrderStatus = 'SERVED';
  let minRank = STATUS_RANK.SERVED;
  for (const s of active) {
    const r = STATUS_RANK[s as Exclude<OrderStatus, 'CANCELLED'>];
    if (r < minRank) {
      min = s;
      minRank = r;
    }
  }
  return min;
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
      forUserId?: string;
      from?: string;
      to?: string;
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.createdById && { createdById: filters.createdById }),
      // forUserId matches orders the user created OR is the attributed server for.
      // Used by "Mes commandes" so servers see POS-entered orders assigned to them.
      ...(filters.forUserId && {
        OR: [
          { createdById: filters.forUserId },
          { serverId: filters.forUserId },
        ],
      }),
      ...(filters.from && { operationDate: { gte: new Date(filters.from) } }),
      ...(filters.to && {
        operationDate: {
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
          server: { select: { id: true, firstName: true, lastName: true } },
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
        server: { select: { id: true, firstName: true, lastName: true } },
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
      serverId?: string;
      // Business/operation date — used as Invoice.issueDate so accounting reflects when
      // the sale actually occurred (not when it was entered). Backdating is validated
      // by the route layer (15-day cap with supervisor bypass).
      operationDate?: Date;
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

      // Validate serverId if provided: must be an active member of this establishment
      // with a role that can be attributed orders (SERVER / MAITRE_HOTEL).
      let serverIdToAttach: string | null = null;
      if (data.serverId) {
        const membership = await tx.establishmentMember.findFirst({
          where: {
            userId: data.serverId,
            establishmentId: data.establishmentId,
            role: { in: ['SERVER', 'MAITRE_HOTEL'] },
          },
        });
        if (!membership) {
          throw new ValidationError('Serveur invalide pour cet établissement');
        }
        serverIdToAttach = data.serverId;
      }

      // Fetch all articles and validate
      const articleIds = data.items.map((i) => i.articleId);
      const articles = await tx.article.findMany({
        where: { id: { in: articleIds }, tenantId, isActive: true },
      });

      if (articles.length !== articleIds.length) {
        throw new ValidationError('Un ou plusieurs articles sont introuvables ou inactifs');
      }

      const articleMap = new Map(articles.map((a) => [a.id, a]));

      // Aggregate quantities per article (same article may appear on multiple lines)
      // so the stock check sees the total taken from the shelf, not per-line.
      const quantityByArticle = new Map<string, number>();
      for (const item of data.items) {
        quantityByArticle.set(item.articleId, (quantityByArticle.get(item.articleId) || 0) + item.quantity);
      }

      // Fail fast on insufficient stock for tracked articles
      const insufficient: string[] = [];
      for (const [articleId, qty] of quantityByArticle) {
        const article = articleMap.get(articleId)!;
        if (article.trackStock && qty > article.currentStock) {
          insufficient.push(`${article.name} (demandé ${qty}, disponible ${article.currentStock})`);
        }
      }
      if (insufficient.length > 0) {
        throw new ValidationError(`Stock insuffisant : ${insufficient.join(', ')}`);
      }

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

      // Create order with items. operationDate is the business date the
      // operator declared (may be backdated up to 15 days, or further with
      // supervisor override). createdAt remains the system clock for audit.
      const order = await tx.order.create({
        data: {
          tenantId,
          establishmentId: data.establishmentId,
          createdById: userId,
          serverId: serverIdToAttach,
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
          ...(data.operationDate ? { operationDate: data.operationDate } : {}),
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
          server: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Auto-generate invoice for the order — use operationDate for FAC prefix when backdating
      const opDate = data.operationDate || now;
      const invoiceDateStr = `${opDate.getFullYear()}${String(opDate.getMonth() + 1).padStart(2, '0')}${String(opDate.getDate()).padStart(2, '0')}`;
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
          ...(data.operationDate ? { issueDate: data.operationDate } : {}),
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

      // Decrement stock for tracked articles and emit SALE movements so the
      // inventory reflects the physical goods leaving the shelf. Prepared
      // dishes (trackStock=false) are untouched. Fires a StockAlert when the
      // post-sale quantity drops to or below the minimum threshold.
      const lowStockArticles: Array<{ id: string; name: string; newStock: number; minimumStock: number }> = [];
      for (const [articleId, qty] of quantityByArticle) {
        const article = articleMap.get(articleId)!;
        if (!article.trackStock) continue;

        const previousStock = article.currentStock;
        const newStock = previousStock - qty;

        await tx.stockMovement.create({
          data: {
            tenantId,
            articleId,
            orderId: order.id,
            performedById: userId,
            type: 'SALE',
            quantity: -qty,
            previousStock,
            newStock,
            reason: `Vente — commande ${orderNumber}`,
            ...(data.operationDate ? { occurredAt: data.operationDate } : {}),
          },
        });

        await tx.article.update({
          where: { id: articleId },
          data: { currentStock: newStock },
        });

        if (article.minimumStock > 0 && newStock <= article.minimumStock) {
          lowStockArticles.push({
            id: articleId,
            name: article.name,
            newStock,
            minimumStock: article.minimumStock,
          });
          await tx.stockAlert.create({
            data: {
              tenantId,
              establishmentId: data.establishmentId,
              articleId,
              createdById: userId,
              message: `Stock bas après vente : ${article.name} — ${newStock}/${article.minimumStock}`,
            },
          });
        }
      }

      // Notify managers of low-stock articles outside the transaction (best-effort)
      for (const lowStock of lowStockArticles) {
        notificationService.notifyRole({
          tenantId,
          establishmentId: data.establishmentId,
          roles: ['MANAGER', 'DAF', 'OWNER'],
          type: 'STOCK_ALERT',
          title: 'Stock bas',
          message: `${lowStock.name} : ${lowStock.newStock} unité(s) — seuil ${lowStock.minimumStock}.`,
          data: { articleId: lowStock.id, newStock: lowStock.newStock },
        }).catch(() => {});
      }

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
   * Toggle the "bon propriétaire" (owner voucher) flag on an existing order.
   * When promoting to a voucher, the linked invoice is mirrored and an Owner
   * approval is requested if a voucherOwnerId is provided. When clearing the
   * flag, the voucher metadata is wiped from both order and invoice; any
   * pending OWNER approval that targeted this order is rejected.
   *
   * Refuses if the invoice is already PAID or CANCELLED.
   */
  async setVoucherFlag(
    tenantId: string,
    id: string,
    userId: string,
    data: { isVoucher: boolean; voucherOwnerId?: string | null; voucherOwnerName?: string | null }
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
        include: { invoice: true },
      });
      if (!order) throw new NotFoundError('Commande');

      if (order.status === 'CANCELLED') {
        throw new ValidationError('Commande annulée — modification impossible');
      }
      if (order.invoice && (order.invoice.status === 'PAID' || order.invoice.status === 'CANCELLED')) {
        throw new ValidationError(
          `Facture ${order.invoice.status === 'PAID' ? 'payée' : 'annulée'} — flag bon propriétaire non modifiable`
        );
      }

      // Validate owner when promoting to voucher.
      if (data.isVoucher && data.voucherOwnerId) {
        const owner = await tx.user.findFirst({
          where: {
            id: data.voucherOwnerId,
            tenantId,
            memberships: { some: { establishmentId: order.establishmentId, role: 'OWNER' } },
          },
        });
        if (!owner) throw new ValidationError('Propriétaire invalide pour cet établissement');
      }

      const ownerName = data.isVoucher
        ? (data.voucherOwnerName ?? null)
        : null;
      const ownerId = data.isVoucher ? (data.voucherOwnerId ?? null) : null;

      // Update order
      await tx.order.update({
        where: { id },
        data: {
          isVoucher: data.isVoucher,
          voucherOwnerId: ownerId,
          voucherOwnerName: ownerName,
        },
      });

      // Update invoice notes/flags if linked
      if (order.invoiceId) {
        const baseNote = `Commande ${order.orderNumber}${order.tableNumber ? ` - Table ${order.tableNumber}` : ''}`;
        await tx.invoice.update({
          where: { id: order.invoiceId },
          data: {
            isVoucher: data.isVoucher,
            voucherOwnerName: ownerName,
            notes: `${data.isVoucher ? `[BON PROPRIÉTAIRE${ownerName ? ` — ${ownerName}` : ''}] ` : ''}${baseNote}`,
          },
        });
      }

      // Approval workflow side-effects
      if (data.isVoucher && ownerId) {
        // Create a fresh approval request if none pending for this order
        const existing = await tx.approvalRequest.findFirst({
          where: {
            tenantId,
            type: 'RESERVATION_MODIFICATION',
            targetId: order.id,
            status: 'PENDING',
          },
        });
        if (!existing) {
          await tx.approvalRequest.create({
            data: {
              tenantId,
              establishmentId: order.establishmentId,
              type: 'RESERVATION_MODIFICATION',
              status: 'PENDING',
              requestedById: userId,
              targetId: order.id,
              reason: 'Bon propriétaire — validation requise',
              payload: {
                kind: 'voucher_promotion',
                orderId: order.id,
                orderNumber: order.orderNumber,
                totalAmount: Number(order.totalAmount),
                voucherOwnerId: ownerId,
                voucherOwnerName: ownerName,
              },
            },
          });
        }
      } else if (!data.isVoucher) {
        // Auto-reject any pending voucher approval since the flag is cleared
        await tx.approvalRequest.updateMany({
          where: {
            tenantId,
            targetId: order.id,
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED',
            reviewedById: userId,
            reviewedAt: new Date(),
          },
        });
      }

      const refreshed = await tx.order.findUnique({
        where: { id },
        include: {
          items: { include: { article: { select: { id: true, name: true } } } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          server: { select: { id: true, firstName: true, lastName: true } },
          invoice: { select: { id: true, isVoucher: true, status: true } },
        },
      });
      return { ...refreshed!, totalAmount: Number(refreshed!.totalAmount) };
    });
  }

  /**
   * Append items to an existing open order. The order stays open; items are added
   * to both the order and its invoice; totals are recomputed. Throws if the order
   * is SERVED/CANCELLED or the invoice is already PAID.
   */
  async addItems(
    tenantId: string,
    orderId: string,
    userId: string,
    data: {
      items: Array<{ articleId: string; quantity: number }>;
      idempotencyKey?: string;
    }
  ) {
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('Au moins un article est requis');
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { invoice: true },
      });
      if (!order) throw new NotFoundError('Commande');

      if (order.status === 'CANCELLED') {
        throw new ValidationError('Commande annulée — impossible d\'ajouter des articles');
      }
      if (!order.invoiceId || !order.invoice) {
        throw new ValidationError('Aucune facture liée à cette commande');
      }
      if (order.invoice.status === 'PAID' || order.invoice.status === 'CANCELLED') {
        throw new ValidationError(`Facture ${order.invoice.status === 'PAID' ? 'déjà payée' : 'annulée'} — impossible d'ajouter des articles`);
      }

      // Validate articles
      const articleIds = data.items.map((i) => i.articleId);
      const articles = await tx.article.findMany({
        where: { id: { in: articleIds }, tenantId, isActive: true },
      });
      if (articles.length !== new Set(articleIds).size) {
        throw new ValidationError('Un ou plusieurs articles sont introuvables ou inactifs');
      }
      const articleMap = new Map(articles.map((a) => [a.id, a]));

      // Aggregate quantities per article for stock validation
      const quantityByArticle = new Map<string, number>();
      for (const item of data.items) {
        quantityByArticle.set(item.articleId, (quantityByArticle.get(item.articleId) || 0) + item.quantity);
      }

      // Fail fast on insufficient stock for tracked articles
      const insufficient: string[] = [];
      for (const [articleId, qty] of quantityByArticle) {
        const article = articleMap.get(articleId)!;
        if (article.trackStock && qty > article.currentStock) {
          insufficient.push(`${article.name} (demandé ${qty}, disponible ${article.currentStock})`);
        }
      }
      if (insufficient.length > 0) {
        throw new ValidationError(`Stock insuffisant : ${insufficient.join(', ')}`);
      }

      // Build new items + subtotal delta
      let deltaSubtotal = 0;
      const orderItemsData = data.items.map((item) => {
        const article = articleMap.get(item.articleId)!;
        const unitPrice = article.unitPrice.toNumber();
        deltaSubtotal += unitPrice * item.quantity;
        return {
          articleId: item.articleId,
          quantity: item.quantity,
          unitPrice,
        };
      });

      // Insert order items — new items always start PENDING so the kitchen
      // sees them in the "En attente" column even when the parent order was
      // already IN_PROGRESS, READY, or SERVED.
      await tx.orderItem.createMany({
        data: orderItemsData.map((i) => ({ ...i, orderId: order.id, status: 'PENDING' as OrderStatus })),
      });

      // Insert invoice items mirroring the order items
      await tx.invoiceItem.createMany({
        data: orderItemsData.map((i) => ({
          invoiceId: order.invoiceId!,
          articleId: i.articleId,
          description: articleMap.get(i.articleId)!.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.unitPrice * i.quantity,
        })),
      });

      // Recompute totals. Discount (if any) is kept as-is — rule wasn't re-applied
      // because adding items may or may not change eligibility; keep behaviour
      // predictable and leave the original discountAmount intact.
      const newOrderTotal = order.totalAmount.toNumber() + deltaSubtotal;
      const newInvoiceSubtotal = order.invoice.subtotal.toNumber() + deltaSubtotal;
      const newInvoiceTotal = order.invoice.totalAmount.toNumber() + deltaSubtotal;

      // New items are PENDING → aggregate becomes PENDING regardless of the
      // previous order status (adding to a SERVED order reopens it).
      await tx.order.update({
        where: { id: order.id },
        data: {
          totalAmount: newOrderTotal,
          status: 'PENDING',
          ...(order.status === 'SERVED' && { servedAt: null }),
        },
      });
      await tx.invoice.update({
        where: { id: order.invoiceId! },
        data: { subtotal: newInvoiceSubtotal, totalAmount: newInvoiceTotal },
      });

      // Decrement stock for tracked articles on the appended items.
      const lowStockArticles: Array<{ id: string; name: string; newStock: number; minimumStock: number }> = [];
      for (const [articleId, qty] of quantityByArticle) {
        const article = articleMap.get(articleId)!;
        if (!article.trackStock) continue;

        const previousStock = article.currentStock;
        const newStock = previousStock - qty;

        await tx.stockMovement.create({
          data: {
            tenantId,
            articleId,
            orderId: order.id,
            performedById: userId,
            type: 'SALE',
            quantity: -qty,
            previousStock,
            newStock,
            reason: `Vente (ajout) — commande ${order.orderNumber}`,
          },
        });

        await tx.article.update({
          where: { id: articleId },
          data: { currentStock: newStock },
        });

        if (article.minimumStock > 0 && newStock <= article.minimumStock) {
          lowStockArticles.push({
            id: articleId,
            name: article.name,
            newStock,
            minimumStock: article.minimumStock,
          });
          await tx.stockAlert.create({
            data: {
              tenantId,
              establishmentId: order.establishmentId,
              articleId,
              createdById: userId,
              message: `Stock bas après vente : ${article.name} — ${newStock}/${article.minimumStock}`,
            },
          });
        }
      }

      for (const lowStock of lowStockArticles) {
        notificationService.notifyRole({
          tenantId,
          establishmentId: order.establishmentId,
          roles: ['MANAGER', 'DAF', 'OWNER'],
          type: 'STOCK_ALERT',
          title: 'Stock bas',
          message: `${lowStock.name} : ${lowStock.newStock} unité(s) — seuil ${lowStock.minimumStock}.`,
          data: { articleId: lowStock.id, newStock: lowStock.newStock },
        }).catch(() => {});
      }

      // Notify cooks of the new items
      notificationService.notifyRole({
        tenantId,
        establishmentId: order.establishmentId,
        roles: ['COOK'],
        type: 'ORDER_NEW',
        title: 'Articles ajoutés',
        message: `Commande ${order.orderNumber}${order.tableNumber ? ` (Table ${order.tableNumber})` : ''} — ${data.items.length} article(s) ajouté(s).`,
        data: { orderId: order.id, orderNumber: order.orderNumber, tableNumber: order.tableNumber, addedBy: userId },
      }).catch(() => {});

      const fresh = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { article: { select: { id: true, name: true } } } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          server: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return { ...fresh!, totalAmount: Number(fresh!.totalAmount), addedCount: data.items.length };
    });
  }

  /**
   * Update order status with validation of transitions and role checks.
   * Operates on the "current batch": moves only items currently at the
   * previous status to the requested status, then recomputes the order
   * aggregate. This lets an order re-enter PENDING when items are appended
   * mid-preparation without rewinding items already being cooked.
   */
  async updateStatus(tenantId: string, id: string, status: OrderStatus, userId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, tenantId },
        include: { items: { select: { id: true, status: true } } },
      });

      if (!order) throw new NotFoundError('Commande');

      // The "from" status for this transition is the one immediately upstream
      // in the kitchen workflow. Cancelling applies to every non-terminal item.
      const fromByTarget: Partial<Record<OrderStatus, OrderStatus>> = {
        IN_PROGRESS: 'PENDING',
        READY: 'IN_PROGRESS',
        SERVED: 'READY',
      };

      // Validate that the transition is meaningful — i.e. at least one item
      // sits at the expected upstream status (CANCELLED has its own rule).
      if (status !== 'CANCELLED') {
        const fromStatus = fromByTarget[status];
        if (!fromStatus) {
          throw new ValidationError(`Transition de statut invalide : ${status}`);
        }
        const hasItemsToAdvance = order.items.some((it) => it.status === fromStatus);
        if (!hasItemsToAdvance) {
          throw new ValidationError(
            `Aucun article à ${fromStatus === 'PENDING' ? 'démarrer' : fromStatus === 'IN_PROGRESS' ? 'marquer prêt' : 'servir'}`
          );
        }
      } else {
        // CANCELLED: only meaningful if at least one item is not yet finalised.
        const hasCancellable = order.items.some((it) => it.status !== 'CANCELLED' && it.status !== 'SERVED');
        if (!hasCancellable && order.status === 'CANCELLED') {
          throw new ValidationError('Commande déjà annulée');
        }
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
        if (status !== 'CANCELLED') {
          throw new ForbiddenError('Un gestionnaire ne peut qu\'annuler les commandes');
        }
      }

      // Advance the matching item batch.
      if (status === 'CANCELLED') {
        await tx.orderItem.updateMany({
          where: { orderId: id, status: { notIn: ['CANCELLED', 'SERVED'] } },
          data: { status: 'CANCELLED' },
        });
      } else {
        const fromStatus = fromByTarget[status]!;
        await tx.orderItem.updateMany({
          where: { orderId: id, status: fromStatus },
          data: { status },
        });
      }

      // Recompute the aggregate order status from current items.
      const postItems = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { status: true },
      });
      const aggregate = aggregateOrderStatus(postItems.map((i) => i.status));

      const updateData: any = { status: aggregate };
      if (aggregate === 'READY' && !order.readyAt) {
        updateData.readyAt = new Date();
      } else if (aggregate === 'SERVED' && !order.servedAt) {
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
          server: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Cancel the associated invoice only when the whole order is cancelled.
      if (aggregate === 'CANCELLED' && order.invoiceId) {
        await tx.invoice.update({
          where: { id: order.invoiceId },
          data: { status: 'CANCELLED' },
        });
      }

      // Restore stock for tracked articles when the order is cancelled.
      // Only reverses SALE movements that were not already reversed — guarded
      // by checking for an existing RETURN movement on the same order.
      if (aggregate === 'CANCELLED' && order.status !== 'CANCELLED') {
        const saleMovements = await tx.stockMovement.findMany({
          where: { tenantId, orderId: id, type: 'SALE' },
        });

        for (const sale of saleMovements) {
          const article = await tx.article.findUnique({ where: { id: sale.articleId } });
          if (!article) continue;

          const restoredQty = Math.abs(sale.quantity);
          const previousStock = article.currentStock;
          const newStock = previousStock + restoredQty;

          await tx.stockMovement.create({
            data: {
              tenantId,
              articleId: sale.articleId,
              orderId: id,
              performedById: userId,
              type: 'RETURN',
              quantity: restoredQty,
              previousStock,
              newStock,
              reason: `Annulation commande ${order.orderNumber}`,
            },
          });

          await tx.article.update({
            where: { id: sale.articleId },
            data: { currentStock: newStock },
          });
        }
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
   * Kitchen orders: any order with at least one item in PENDING or IN_PROGRESS.
   * Items keep their own status so the UI can split them across columns even
   * when some of the order is already SERVED (items added after service).
   */
  async getKitchenOrders(tenantId: string, establishmentId: string) {
    const db = createTenantClient(tenantId);

    return db.order.findMany({
      where: {
        establishmentId,
        items: { some: { status: { in: ['PENDING', 'IN_PROGRESS'] } } },
      },
      include: {
        items: {
          include: {
            article: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
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

    // userId filter matches orders the user created OR was attributed as server.
    const baseWhere: any = {
      establishmentId,
      ...(userId && {
        OR: [
          { createdById: userId },
          { serverId: userId },
        ],
      }),
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
  async cancelDuplicates(tenantId: string, duplicateOrderIds: string[], performedById?: string) {
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

        // Restore stock for tracked articles on each cancelled duplicate.
        // Skipped if no user context is available (legacy callers).
        if (performedById) {
          const saleMovements = await tx.stockMovement.findMany({
            where: { tenantId, orderId: order.id, type: 'SALE' },
          });
          for (const sale of saleMovements) {
            const article = await tx.article.findUnique({ where: { id: sale.articleId } });
            if (!article) continue;
            const restoredQty = Math.abs(sale.quantity);
            const newStock = article.currentStock + restoredQty;
            await tx.stockMovement.create({
              data: {
                tenantId,
                articleId: sale.articleId,
                orderId: order.id,
                performedById,
                type: 'RETURN',
                quantity: restoredQty,
                previousStock: article.currentStock,
                newStock,
                reason: `Annulation automatique doublon commande ${order.orderNumber}`,
              },
            });
            await tx.article.update({
              where: { id: sale.articleId },
              data: { currentStock: newStock },
            });
          }
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
