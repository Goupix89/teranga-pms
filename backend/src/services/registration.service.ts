import bcrypt from 'bcryptjs';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import { ConflictError, AppError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/encryption';

const RESERVED_SLUGS = new Set([
  'api', 'admin', 'www', 'mail', 'app', 'static', 'cdn',
  'auth', 'login', 'signup', 'register', 'dashboard',
  'support', 'help', 'docs', 'status', 'health',
]);

/** Grace period after expiration before suspension (days) */
const GRACE_PERIOD_DAYS = 7;

export class RegistrationService {
  /**
   * List active subscription plans for display on the registration page.
   */
  async getPlans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        monthlyPrice: true,
        yearlyPrice: true,
        features: true,
        displayOrder: true,
        trialDays: true,
      },
    });
  }

  /**
   * Register a new tenant with an admin user.
   * Creates a FedaPay transaction for the first payment.
   * If the plan has a trial, the tenant is activated immediately.
   */
  async register(data: {
    tenantName: string;
    slug: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    planSlug: string;
    billingInterval: 'MONTHLY' | 'YEARLY';
    skipTrial?: boolean;
  }) {
    const { tenantName, slug, email, password, firstName, lastName, planSlug, billingInterval, skipTrial } = data;

    // Validate slug
    if (RESERVED_SLUGS.has(slug)) {
      throw new ConflictError('Ce slug est réservé');
    }

    // Check slug uniqueness
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      throw new ConflictError('Ce slug est déjà utilisé');
    }

    // Check email uniqueness across all tenants
    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingUser) {
      throw new ConflictError('Cet email est déjà utilisé');
    }

    // Look up plan
    const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } });
    if (!plan) {
      throw new NotFoundError('Plan');
    }

    const hasTrial = plan.trialDays > 0 && !skipTrial;
    const now = new Date();

    // Create tenant + owner user + default establishment + subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug,
          plan: planSlug,
          isActive: hasTrial, // Active immediately if trial
          settings: { currency: 'XOF', language: 'fr' },
        },
      });

      const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: email.toLowerCase().trim(),
          passwordHash,
          firstName,
          lastName,
          role: 'EMPLOYEE',
          status: hasTrial ? 'ACTIVE' : 'LOCKED',
        },
      });

      // Create a default establishment for the owner
      const establishment = await tx.establishment.create({
        data: {
          tenantId: tenant.id,
          name: tenantName,
          address: '',
          city: '',
          country: 'BJ',
          timezone: 'Africa/Porto-Novo',
          currency: 'XOF',
        },
      });

      // Assign OWNER role on the default establishment
      await tx.establishmentMember.create({
        data: {
          userId: user.id,
          establishmentId: establishment.id,
          role: 'OWNER',
        },
      });

      const trialEndsAt = hasTrial
        ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
        : null;

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: hasTrial ? 'TRIAL' : 'PENDING',
          billingInterval,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt || undefined,
          trialEndsAt,
        },
      });

      return tenant;
    });

    // If trial: no payment needed yet, return success
    if (hasTrial) {
      logger.info('New tenant registered with trial', {
        tenantId: result.id,
        slug,
        planSlug,
        trialDays: plan.trialDays,
      });

      return {
        tenantId: result.id,
        trial: true,
        trialDays: plan.trialDays,
        message: `Votre essai gratuit de ${plan.trialDays} jours a commencé. Bienvenue !`,
      };
    }

    // No trial: create FedaPay transaction for first payment
    const price = billingInterval === 'MONTHLY'
      ? Number(plan.monthlyPrice)
      : Number(plan.yearlyPrice);

    const checkoutUrl = await this.createFedapayCheckout({
      tenantId: result.id,
      amount: price,
      description: `Abonnement ${plan.name} — ${billingInterval === 'MONTHLY' ? 'Mensuel' : 'Annuel'}`,
      billingInterval,
    });

    logger.info('New tenant registered, awaiting payment', {
      tenantId: result.id,
      slug,
      planSlug,
    });

    return { tenantId: result.id, checkoutUrl };
  }

  /**
   * Create a FedaPay transaction and return the checkout URL.
   */
  async createFedapayCheckout(params: {
    tenantId: string;
    amount: number;
    description: string;
    billingInterval: 'MONTHLY' | 'YEARLY';
    isRenewal?: boolean;
  }): Promise<string> {
    const { tenantId, amount, description, billingInterval, isRenewal } = params;

    const fedapayKey = config.fedapay.secretKey;
    if (!fedapayKey) {
      throw new AppError('FedaPay non configuré', 503, 'FEDAPAY_NOT_CONFIGURED');
    }

    const isSandbox = config.fedapay.isSandbox;
    const apiBase = isSandbox
      ? 'https://sandbox-api.fedapay.com'
      : 'https://api.fedapay.com';

    // Calculate billing period
    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now);
    if (billingInterval === 'MONTHLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Create FedaPay transaction
    const txnResponse = await fetch(`${apiBase}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fedapayKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        amount,
        currency: { iso: 'XOF' },
        callback_url: `${config.fedapay.callbackUrl}${isRenewal ? '?renewal=true' : ''}`,
        custom_metadata: {
          type: 'subscription',
          tenant_id: tenantId,
          billing_interval: billingInterval,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          is_renewal: isRenewal ? 'true' : 'false',
        },
      }),
    });

    const txnData = await txnResponse.json() as any;
    logger.info('FedaPay subscription txn response', {
      status: txnResponse.status,
      body: JSON.stringify(txnData).substring(0, 500),
    });

    if (!txnResponse.ok && txnResponse.status !== 201) {
      throw new AppError('Erreur lors de la création de la transaction FedaPay', 502, 'FEDAPAY_ERROR');
    }

    // Extract transaction ID
    let transactionId: string | number | undefined;
    if (txnData?.['v1/transaction']?.id) {
      transactionId = txnData['v1/transaction'].id;
    } else if (txnData?.transaction?.id) {
      transactionId = txnData.transaction.id;
    } else {
      for (const [k, v] of Object.entries(txnData || {})) {
        if (k.includes('transaction') && typeof v === 'object' && (v as any)?.id) {
          transactionId = (v as any).id;
          break;
        }
      }
    }

    if (!transactionId) {
      throw new AppError('Impossible d\'extraire l\'ID de transaction FedaPay', 502, 'FEDAPAY_ERROR');
    }

    // Record pending subscription payment
    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (subscription) {
      await prisma.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          amount,
          currency: 'XOF',
          fedapayTxnId: String(transactionId),
          status: 'PENDING',
          periodStart,
          periodEnd,
        },
      });
    }

    // Get checkout token/URL
    const tokenResponse = await fetch(`${apiBase}/v1/transactions/${transactionId}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fedapayKey}`,
        'Content-Type': 'application/json',
      },
    });

    const tokenData = await tokenResponse.json() as any;

    let checkoutUrl = tokenData?.url;
    const token = tokenData?.token;
    if (!checkoutUrl && !token) {
      for (const [, v] of Object.entries(tokenData || {})) {
        if (typeof v === 'object') {
          if (!checkoutUrl && (v as any)?.url) checkoutUrl = (v as any).url;
        }
      }
    }

    if (checkoutUrl) return checkoutUrl;
    if (token) {
      return isSandbox
        ? `https://sandbox-process.fedapay.com/${token}`
        : `https://process.fedapay.com/${token}`;
    }

    throw new AppError('Impossible de générer l\'URL de paiement FedaPay', 502, 'FEDAPAY_ERROR');
  }

  /**
   * Handle FedaPay webhook for subscription payments.
   */
  async handleSubscriptionPayment(fedapayTxnId: string, metadata: any) {
    const tenantId = metadata?.tenant_id;
    if (!tenantId) {
      logger.warn('FedaPay subscription webhook: missing tenant_id in metadata');
      return;
    }

    // Find the pending subscription payment
    const subPayment = await prisma.subscriptionPayment.findUnique({
      where: { fedapayTxnId: String(fedapayTxnId) },
      include: { subscription: true },
    });

    if (!subPayment) {
      logger.warn('FedaPay subscription webhook: no pending payment found', { fedapayTxnId });
      return;
    }

    if (subPayment.status === 'PAID') {
      logger.info('FedaPay subscription payment already processed', { fedapayTxnId });
      return;
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Mark payment as paid
      await tx.subscriptionPayment.update({
        where: { id: subPayment.id },
        data: { status: 'PAID', paidAt: now },
      });

      // Update subscription
      await tx.subscription.update({
        where: { tenantId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: subPayment.periodStart,
          currentPeriodEnd: subPayment.periodEnd,
          lastPaymentAt: now,
          lastPaymentRef: String(fedapayTxnId),
          gracePeriodEndsAt: null,
        },
      });

      // Activate tenant
      await tx.tenant.update({
        where: { id: tenantId },
        data: { isActive: true },
      });

      // Unlock all locked users of this tenant
      await tx.user.updateMany({
        where: { tenantId, status: 'LOCKED' },
        data: { status: 'ACTIVE' },
      });
    });

    logger.info('Subscription payment confirmed via FedaPay', {
      tenantId,
      fedapayTxnId,
      periodEnd: subPayment.periodEnd,
    });
  }

  /**
   * Generate a renewal payment link for an expiring subscription.
   */
  async generateRenewalLink(tenantId: string): Promise<string | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) return null;

    const price = subscription.billingInterval === 'MONTHLY'
      ? Number(subscription.plan.monthlyPrice)
      : Number(subscription.plan.yearlyPrice);

    try {
      const checkoutUrl = await this.createFedapayCheckout({
        tenantId,
        amount: price,
        description: `Renouvellement ${subscription.plan.name} — ${subscription.billingInterval === 'MONTHLY' ? 'Mensuel' : 'Annuel'}`,
        billingInterval: subscription.billingInterval,
        isRenewal: true,
      });

      await prisma.subscription.update({
        where: { tenantId },
        data: { lastRenewalLinkSentAt: new Date() },
      });

      return checkoutUrl;
    } catch (err) {
      logger.error('Failed to generate renewal link', { tenantId, error: String(err) });
      return null;
    }
  }
}

export const registrationService = new RegistrationService();
