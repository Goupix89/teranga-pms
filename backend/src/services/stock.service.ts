import { StockMovementType } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class StockService {
  /**
   * List stock movements with filters.
   */
  async listMovements(
    tenantId: string,
    params: PaginationParams,
    filters: { articleId?: string; type?: StockMovementType; from?: string; to?: string; pendingApproval?: boolean } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(filters.articleId && { articleId: filters.articleId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.from && { createdAt: { gte: new Date(filters.from) } }),
      ...(filters.to && { createdAt: { ...((filters.from && { gte: new Date(filters.from) }) || {}), lte: new Date(filters.to) } }),
      ...(filters.pendingApproval && { requiresApproval: true, approvedAt: null }),
    };

    const [data, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        include: {
          article: { select: { id: true, name: true, sku: true, unit: true } },
          supplier: { select: { id: true, name: true } },
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        ...toSkipTake(params),
      }),
      db.stockMovement.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  /**
   * Create a stock movement (purchase, adjustment, waste, etc.)
   */
  async createMovement(tenantId: string, performedById: string, data: {
    articleId: string;
    supplierId?: string;
    type: StockMovementType;
    quantity: number;
    unitCost?: number;
    reason?: string;
    occurredAt?: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const article = await tx.article.findFirst({
        where: { id: data.articleId, tenantId },
      });

      if (!article) throw new NotFoundError('Article');

      // Validate supplier if provided
      if (data.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: data.supplierId, tenantId },
        });
        if (!supplier) throw new NotFoundError('Fournisseur');
      }

      // Determine quantity sign based on movement type
      let effectiveQuantity = data.quantity;
      if (['SALE', 'WASTE', 'RETURN'].includes(data.type)) {
        effectiveQuantity = -Math.abs(data.quantity);
      } else if (['PURCHASE'].includes(data.type)) {
        effectiveQuantity = Math.abs(data.quantity);
      }
      // ADJUSTMENT and TRANSFER keep the sign as-is

      const previousStock = article.currentStock;
      const newStock = previousStock + effectiveQuantity;

      // Check if adjustment has variance > threshold
      let requiresApproval = false;
      if (data.type === 'ADJUSTMENT') {
        const variancePercent = previousStock > 0
          ? Math.abs(effectiveQuantity / previousStock) * 100
          : (effectiveQuantity !== 0 ? 100 : 0);

        if (variancePercent > config.stock.varianceThresholdPercent) {
          requiresApproval = true;
          logger.warn('Stock variance exceeds threshold', {
            tenantId,
            articleId: data.articleId,
            articleName: article.name,
            variancePercent: variancePercent.toFixed(1),
            threshold: config.stock.varianceThresholdPercent,
          });
        }
      }

      // Create the movement
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          articleId: data.articleId,
          supplierId: data.supplierId,
          performedById,
          type: data.type,
          quantity: effectiveQuantity,
          unitCost: data.unitCost,
          previousStock,
          newStock,
          reason: data.reason,
          requiresApproval,
          ...(data.occurredAt ? { occurredAt: data.occurredAt } : {}),
        },
        include: {
          article: { select: { name: true, sku: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
      });

      // Apply stock change immediately UNLESS approval is required
      if (!requiresApproval) {
        await tx.article.update({
          where: { id: data.articleId },
          data: { currentStock: newStock },
        });
      }

      logger.info('Stock movement created', {
        tenantId,
        movementId: movement.id,
        type: data.type,
        articleId: data.articleId,
        quantity: effectiveQuantity,
        requiresApproval,
      });

      return {
        movement,
        requiresApproval,
        variancePercent: requiresApproval
          ? (previousStock > 0 ? Math.abs(effectiveQuantity / previousStock) * 100 : 100).toFixed(1)
          : undefined,
      };
    });
  }

  /**
   * Approve a pending stock adjustment.
   */
  async approveMovement(tenantId: string, movementId: string, approvedById: string) {
    return prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findFirst({
        where: { id: movementId, tenantId, requiresApproval: true, approvedAt: null },
      });

      if (!movement) {
        throw new NotFoundError('Mouvement en attente d\'approbation');
      }

      // Apply the stock change
      await tx.article.update({
        where: { id: movement.articleId },
        data: { currentStock: movement.newStock },
      });

      // Mark as approved
      const approved = await tx.stockMovement.update({
        where: { id: movementId },
        data: { approvedById, approvedAt: new Date() },
        include: {
          article: { select: { name: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
      });

      logger.info('Stock movement approved', {
        tenantId,
        movementId,
        approvedById,
        articleId: movement.articleId,
      });

      return approved;
    });
  }

  /**
   * Get articles with low stock (below minimum threshold).
   */
  async getLowStockArticles(tenantId: string) {
    const db = createTenantClient(tenantId);

    return db.article.findMany({
      where: {
        isActive: true,
        currentStock: { lte: prisma.article.fields.minimumStock as any },
      },
      // Workaround: use raw query for column comparison
    });
  }
}

export const stockService = new StockService();
