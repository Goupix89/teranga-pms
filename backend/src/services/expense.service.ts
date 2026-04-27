import PDFDocument from 'pdfkit';
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
          customCategory: { select: { id: true, name: true } },
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
        customCategory: { select: { id: true, name: true } },
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
      customCategoryId?: string | null;
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

    if (data.customCategoryId) {
      const cat = await prisma.expenseCustomCategory.findFirst({
        where: { id: data.customCategoryId, tenantId },
      });
      if (!cat) throw new NotFoundError('Catégorie personnalisée');
    }

    const created = await prisma.expense.create({
      data: {
        tenantId,
        establishmentId: data.establishmentId,
        amount: data.amount,
        reason: data.reason.trim(),
        category: data.category ?? 'OTHER',
        customCategoryId: data.customCategoryId ?? null,
        paymentMethod: data.paymentMethod ?? 'CASH',
        supplierId: data.supplierId ?? null,
        operationDate: data.operationDate ?? new Date(),
        notes: data.notes?.trim() || null,
        performedById,
      },
      include: {
        establishment: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        customCategory: { select: { id: true, name: true } },
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
      customCategoryId?: string | null;
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
        ...(data.customCategoryId !== undefined && { customCategoryId: data.customCategoryId }),
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
        ...(data.operationDate && { operationDate: data.operationDate }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      },
      include: {
        establishment: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        customCategory: { select: { id: true, name: true } },
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

  // ---------------------------------------------------------------------------
  // Custom categories
  // ---------------------------------------------------------------------------

  async listCategories(tenantId: string) {
    return prisma.expenseCustomCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdAt: true },
    });
  }

  async createCategory(tenantId: string, name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new ValidationError('Le nom de la catégorie doit comporter au moins 2 caractères');
    if (trimmed.length > 80) throw new ValidationError('Le nom de la catégorie ne doit pas dépasser 80 caractères');

    const existing = await prisma.expenseCustomCategory.findFirst({
      where: { tenantId, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) return existing; // idempotent

    return prisma.expenseCustomCategory.create({
      data: { tenantId, name: trimmed },
      select: { id: true, name: true, createdAt: true },
    });
  }

  async deleteCategory(tenantId: string, id: string) {
    const cat = await prisma.expenseCustomCategory.findFirst({ where: { id, tenantId } });
    if (!cat) throw new NotFoundError('Catégorie');

    const usageCount = await prisma.expense.count({ where: { customCategoryId: id, deletedAt: null } });
    if (usageCount > 0) {
      throw new ValidationError(
        `Cette catégorie est utilisée par ${usageCount} décaissement(s) actif(s). Réattribuez-les avant de la supprimer.`
      );
    }

    await prisma.expenseCustomCategory.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Bon de décaissement — PDF
  // ---------------------------------------------------------------------------

  private readonly CATEGORY_LABELS: Record<string, string> = {
    SUPPLIES: 'Fournitures', SALARY: 'Salaires', UTILITIES: 'Électricité / eau',
    RENT: 'Loyer', MAINTENANCE: 'Entretien', TRANSPORT: 'Transport',
    MARKETING: 'Marketing', TAXES: 'Impôts & taxes', OTHER: 'Autre',
  };

  private readonly METHOD_LABELS: Record<string, string> = {
    CASH: 'Espèces', CARD: 'Carte bancaire', BANK_TRANSFER: 'Virement bancaire',
    MOBILE_MONEY: 'Mobile Money', MOOV_MONEY: 'Flooz (Moov)', MIXX_BY_YAS: 'Yas (MTN)',
    FEDAPAY: 'FedaPay', OTHER: 'Autre',
  };

  private fmtCurrency(n: number): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(n) + ' FCFA';
  }

  private fmtDate(d: Date, long = false): string {
    return d.toLocaleDateString('fr-FR', long
      ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' }
    );
  }

  async generateVoucherPDF(tenantId: string, id: string): Promise<Buffer> {
    const expense = await this.getById(tenantId, id);

    // Voucher number: count expenses of this tenant created before or at this one
    const seqCount = await prisma.expense.count({
      where: { tenantId, createdAt: { lte: expense.createdAt } },
    });
    const d = new Date(expense.createdAt);
    const dateKey = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const voucherNumber = `DEC-${dateKey}-${String(seqCount).padStart(4, '0')}`;

    const establishment = expense.establishment as { name: string } | null;
    const categoryLabel = expense.customCategory?.name
      ?? this.CATEGORY_LABELS[expense.category]
      ?? expense.category;
    const methodLabel = this.METHOD_LABELS[expense.paymentMethod] ?? expense.paymentMethod;
    const performedBy = expense.performedBy
      ? `${(expense.performedBy as any).firstName} ${(expense.performedBy as any).lastName}`
      : '—';
    const supplierName = expense.supplier ? (expense.supplier as any).name : '—';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A5', margin: 40, info: { Title: voucherNumber } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 80; // usable width (margin * 2)
      const L = 40; // left margin

      const drawRule = (y?: number) => {
        const yCur = y ?? doc.y;
        doc.moveTo(L, yCur).lineTo(L + W, yCur).strokeColor('#cccccc').lineWidth(0.5).stroke();
        doc.moveDown(0.3);
      };

      // ── HEADER ──────────────────────────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a2e')
        .text(establishment?.name ?? 'Établissement', L, 40, { width: W, align: 'center' });

      doc.fontSize(8).font('Helvetica').fillColor('#666666')
        .text('BON DE DÉCAISSEMENT', { width: W, align: 'center' });

      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#c0392b')
        .text(voucherNumber, { width: W, align: 'center' });

      doc.moveDown(0.6);
      drawRule();
      doc.moveDown(0.4);

      // ── DATES ───────────────────────────────────────────────────────────────
      const row = (label: string, value: string) => {
        const yStart = doc.y;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555')
          .text(label, L, yStart, { width: 130, continued: false });
        doc.fontSize(8).font('Helvetica').fillColor('#1a1a2e')
          .text(value, L + 135, yStart, { width: W - 135 });
        doc.moveDown(0.25);
      };

      row("Date d'opération :", this.fmtDate(new Date(expense.operationDate), true));
      row("Date d'émission  :", this.fmtDate(new Date(), true));
      doc.moveDown(0.4);
      drawRule();
      doc.moveDown(0.4);

      // ── DETAIL ──────────────────────────────────────────────────────────────
      row('Motif :', expense.reason);
      row('Catégorie :', categoryLabel);
      row('Mode de paiement :', methodLabel);
      row('Fournisseur :', supplierName);
      row('Saisi par :', performedBy);

      if (expense.notes) {
        doc.moveDown(0.2);
        row('Notes :', expense.notes);
      }

      doc.moveDown(0.6);
      drawRule();

      // ── AMOUNT BOX ──────────────────────────────────────────────────────────
      const boxY = doc.y + 6;
      const boxH = 48;
      doc.roundedRect(L, boxY, W, boxH, 6).fillColor('#fdf0f0').fill();
      doc.roundedRect(L, boxY, W, boxH, 6).strokeColor('#e74c3c').lineWidth(1).stroke();

      doc.fontSize(8).font('Helvetica').fillColor('#c0392b')
        .text('MONTANT DU DÉCAISSEMENT', L, boxY + 8, { width: W, align: 'center' });
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#c0392b')
        .text(this.fmtCurrency(expense.amount), L, boxY + 22, { width: W, align: 'center' });

      doc.y = boxY + boxH + 16;
      drawRule();
      doc.moveDown(0.6);

      // ── SIGNATURES ──────────────────────────────────────────────────────────
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555')
        .text('SIGNATURES', L, doc.y, { width: W });
      doc.moveDown(0.5);

      const sigW = (W - 20) / 3;
      const sigLabels = ["Émetteur", "Contrôleur", "Approbateur (DAF)"];
      const sigY = doc.y;
      sigLabels.forEach((lbl, i) => {
        const x = L + i * (sigW + 10);
        doc.fontSize(7).font('Helvetica').fillColor('#666666').text(lbl, x, sigY, { width: sigW, align: 'center' });
        const lineY = sigY + 30;
        doc.moveTo(x + 10, lineY).lineTo(x + sigW - 10, lineY).strokeColor('#aaaaaa').lineWidth(0.5).stroke();
      });

      doc.y = sigY + 40;
      doc.moveDown(0.8);
      drawRule();

      // ── FOOTER ──────────────────────────────────────────────────────────────
      doc.fontSize(7).font('Helvetica').fillColor('#999999')
        .text(
          `Document généré le ${this.fmtDate(new Date(), true)} — Teranga PMS`,
          L, doc.y + 4, { width: W, align: 'center' }
        );

      doc.end();
    });
  }
}

export const expenseService = new ExpenseService();
