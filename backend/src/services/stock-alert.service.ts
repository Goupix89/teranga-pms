import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';

export class StockAlertService {
  /**
   * List stock alerts with filters and pagination.
   */
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: {
      establishmentId?: string;
      isResolved?: boolean;
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
      ...(filters.isResolved !== undefined && { isResolved: filters.isResolved }),
    };

    const [data, total] = await Promise.all([
      db.stockAlert.findMany({
        where,
        include: {
          article: { select: { id: true, name: true, sku: true, currentStock: true, minimumStock: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        ...toSkipTake(params),
      }),
      db.stockAlert.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  /**
   * Create a new stock alert.
   */
  async create(
    tenantId: string,
    data: {
      establishmentId: string;
      articleId: string;
      createdById: string;
      message: string;
    }
  ) {
    return prisma.stockAlert.create({
      data: {
        tenantId,
        establishmentId: data.establishmentId,
        articleId: data.articleId,
        createdById: data.createdById,
        message: data.message,
      },
      include: {
        article: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Mark a stock alert as resolved.
   */
  async resolve(tenantId: string, id: string) {
    const alert = await prisma.stockAlert.findFirst({
      where: { id, tenantId, isResolved: false },
    });

    if (!alert) throw new NotFoundError('Alerte de stock');

    return prisma.stockAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
      include: {
        article: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get count of unresolved stock alerts for an establishment.
   */
  async getUnresolvedCount(tenantId: string, establishmentId: string) {
    const db = createTenantClient(tenantId);

    return db.stockAlert.count({
      where: {
        establishmentId,
        isResolved: false,
      },
    });
  }
}

export const stockAlertService = new StockAlertService();
