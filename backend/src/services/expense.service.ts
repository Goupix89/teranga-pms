import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { paginate } from '../utils/helpers';
import { PaginationParams } from '../types';

export class ExpenseService {
  /**
   * List expenses (décaissements) scoped to tenant, paginated, filterable.
   * Soft-deleted rows are excluded unless includeDeleted=true.
   */
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: {
      establishmentId?: string;
      from?: string;
      to?: string;
      category?: ExpenseCategory;
      includeDeleted?: boolean;
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
      ...(filters.category && { category: filters.category }),
      ...(!filters.includeDeleted && { deletedAt: null }),
    };

    if (filters.from || filters.to) {
      where.operationDate = {
        ...(filters.from && { gte: new Date(filters.from) }),
        ...(filters.to && { lte: new Date(filters.to) }),
      };
    }

    const [data, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          establishment: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          performedBy: { select: { id: true, firstName: true, lastName: true } },
          deletedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { operationDate: 'desc' },
      }),
      db.expense.count({ where }),
    ]);

    return paginate(
      data.map((e) => ({ ...e, amount: Number(e.amount) })),
      total,
      params
    );
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);
    const expense = await db.expense.findFirst({
      where: { id },
      include: {
        establishment: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        deletedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!expense) throw new NotFoundError('Décaissement');
    return { ...expense, amount: Number(expense.amount) };
  }

  async create(
    tenantId: string,
    performedById: string,
    data: {
      establishmentId: string;
      amount: number;
      reason: string;
      category?: ExpenseCategory;
      paymentMethod?: PaymentMethod;
      supplierId?: string | null;
      operationDate?: Date;
      notes?: string;
    }
  ) {
    if (data.amount <= 0) {
      throw new ValidationError('Le montant doit être supérieur à 0');
    }
    if (!data.reason || data.reason.trim().length < 3) {
      throw new ValidationError('Le motif est obligatoire (min. 3 caractères)');
    }

    // Verify establishment belongs to tenant
    const establishment = await prisma.establishment.findFirst({
      where: { id: data.establishmentId, tenantId },
    });
    if (!establishment) throw new NotFoundError('Établissement');

    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, tenantId },
      });
      if (!supplier) throw new NotFoundError('Fournisseur');
    }

    const created = await prisma.expense.create({
      data: {
        tenantId,
        establishmentId: data.establishmentId,
        amount: data.amount,
        reason: data.reason.trim(),
        category: data.category ?? 'OTHER',
        paymentMethod: data.paymentMethod ?? 'CASH',
        supplierId: data.supplierId ?? null,
        operationDate: data.operationDate ?? new Date(),
        notes: data.notes?.trim() || null,
        performedById,
      },
      include: {
        establishment: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { ...created, amount: Number(created.amount) };
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      amount?: number;
      reason?: string;
      category?: ExpenseCategory;
      paymentMethod?: PaymentMethod;
      supplierId?: string | null;
      operationDate?: Date;
      notes?: string;
    }
  ) {
    const db = createTenantClient(tenantId);
    const existing = await db.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError('Décaissement');

    if (data.amount !== undefined && data.amount <= 0) {
      throw new ValidationError('Le montant doit être supérieur à 0');
    }
    if (data.reason !== undefined && data.reason.trim().length < 3) {
      throw new ValidationError('Le motif est obligatoire (min. 3 caractères)');
    }
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, tenantId },
      });
      if (!supplier) throw new NotFoundError('Fournisseur');
    }

    const updated = await db.expense.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.reason !== undefined && { reason: data.reason.trim() }),
        ...(data.category && { category: data.category }),
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
        ...(data.operationDate && { operationDate: data.operationDate }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      },
      include: {
        establishment: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { ...updated, amount: Number(updated.amount) };
  }

  /**
   * Soft-delete an expense. The row stays in DB for accounting traceability
   * and is excluded from listings and totals by default.
   */
  async softDelete(tenantId: string, id: string, deletedById: string) {
    const db = createTenantClient(tenantId);
    const existing = await db.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError('Décaissement');

    await db.expense.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById },
    });
  }

  /**
   * Aggregate decaissement totals over a date range.
   * Used by the daily report + revenue summary to compute CA net.
   */
  async summary(
    tenantId: string,
    filters: { establishmentId?: string; from: Date; to: Date }
  ) {
    const db = createTenantClient(tenantId);
    const where: any = {
      deletedAt: null,
      operationDate: { gte: filters.from, lte: filters.to },
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
    };

    const [totalAgg, byCategory, byMethod] = await Promise.all([
      db.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
      db.expense.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const total = Number(totalAgg._sum.amount ?? 0);
    const count = totalAgg._count;

    const byCategoryMap: Record<string, { total: number; count: number }> = {};
    for (const row of byCategory) {
      byCategoryMap[row.category] = {
        total: Number(row._sum.amount ?? 0),
        count: row._count,
      };
    }

    const byMethodMap: Record<string, { total: number; count: number }> = {};
    for (const row of byMethod) {
      byMethodMap[row.paymentMethod] = {
        total: Number(row._sum.amount ?? 0),
        count: row._count,
      };
    }

    return { total, count, byCategory: byCategoryMap, byMethod: byMethodMap };
  }
}

export const expenseService = new ExpenseService();
