import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';

export type DiscountAppliesTo = 'RESERVATION' | 'ORDER' | 'BOTH';
export type DiscountType = 'PERCENTAGE' | 'FIXED';

export class DiscountService {
  async list(tenantId: string, filters: { appliesTo?: DiscountAppliesTo; isActive?: boolean } = {}) {
    const db = createTenantClient(tenantId);
    const where: any = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.appliesTo) where.appliesTo = { in: [filters.appliesTo, 'BOTH'] };
    return db.discountRule.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async create(tenantId: string, data: {
    name: string; description?: string;
    type: DiscountType; value: number;
    appliesTo: DiscountAppliesTo;
    minNights?: number; maxNights?: number; minAmount?: number;
    autoApply?: boolean;
  }) {
    if (data.type === 'PERCENTAGE' && (data.value < 0 || data.value > 100)) {
      throw new ValidationError('Le pourcentage doit être entre 0 et 100');
    }
    if (data.value < 0) throw new ValidationError('La valeur doit être positive');
    if (data.minNights != null && data.maxNights != null && data.maxNights < data.minNights) {
      throw new ValidationError('Le nombre max de nuits doit être ≥ au minimum');
    }
    return prisma.discountRule.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        type: data.type,
        value: data.value,
        appliesTo: data.appliesTo,
        minNights: data.minNights,
        maxNights: data.maxNights,
        minAmount: data.minAmount,
        autoApply: data.autoApply ?? false,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const rule = await prisma.discountRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundError('Règle de remise');
    return prisma.discountRule.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const rule = await prisma.discountRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundError('Règle de remise');
    // Soft disable — keeps historical records intact
    return prisma.discountRule.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Compute discount amount against a subtotal.
   */
  computeAmount(rule: { type: string; value: any }, subtotal: number): number {
    const val = Number(rule.value);
    if (rule.type === 'PERCENTAGE') {
      return Math.round(subtotal * val / 100);
    }
    return Math.min(val, subtotal);
  }

  /**
   * Find the best auto-applicable reservation discount.
   * Only Owner-defined rules flagged autoApply=true are considered — no built-in tiers.
   * Returns { rule, amount } or null.
   */
  async findAutoReservationDiscount(
    tenantId: string,
    ctx: { nights: number; subtotal: number }
  ): Promise<{ rule: any; amount: number } | null> {
    let best: { rule: any; amount: number } | null = null;

    const rules = await prisma.discountRule.findMany({
      where: {
        tenantId,
        isActive: true,
        autoApply: true,
        appliesTo: { in: ['RESERVATION', 'BOTH'] },
      },
    });
    for (const rule of rules) {
      if (rule.minNights && ctx.nights < rule.minNights) continue;
      if (rule.maxNights && ctx.nights > rule.maxNights) continue;
      if (rule.minAmount && ctx.subtotal < Number(rule.minAmount)) continue;
      const amount = this.computeAmount(rule, ctx.subtotal);
      if (!best || amount > best.amount) best = { rule, amount };
    }
    return best;
  }

  /**
   * Orders: no automatic discount — manager picks a rule manually.
   */
  async findAutoOrderDiscount(
    _tenantId: string,
    _ctx: { subtotal: number }
  ): Promise<{ rule: any; amount: number } | null> {
    return null;
  }

  /**
   * Apply a specific rule (manual). Returns { rule, amount } or throws.
   */
  async apply(tenantId: string, ruleId: string, ctx: { nights?: number; subtotal: number; appliesTo: DiscountAppliesTo }) {
    const rule = await prisma.discountRule.findFirst({ where: { id: ruleId, tenantId, isActive: true } });
    if (!rule) throw new NotFoundError('Règle de remise');
    if (rule.appliesTo !== 'BOTH' && rule.appliesTo !== ctx.appliesTo) {
      throw new ValidationError(`Cette remise ne s'applique pas à ce type (${ctx.appliesTo})`);
    }
    if (rule.minNights && ctx.nights !== undefined && ctx.nights < rule.minNights) {
      throw new ValidationError(`Minimum ${rule.minNights} nuits requis`);
    }
    if (rule.maxNights && ctx.nights !== undefined && ctx.nights > rule.maxNights) {
      throw new ValidationError(`Maximum ${rule.maxNights} nuits autorisées pour cette remise`);
    }
    if (rule.minAmount && ctx.subtotal < Number(rule.minAmount)) {
      throw new ValidationError(`Montant minimum ${Number(rule.minAmount)} FCFA`);
    }
    const amount = this.computeAmount(rule, ctx.subtotal);
    return { rule, amount };
  }
}

export const discountService = new DiscountService();
