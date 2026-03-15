import Stripe from 'stripe';
import bcrypt from 'bcrypt';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import { ConflictError, AppError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const RESERVED_SLUGS = new Set([
  'api', 'admin', 'www', 'mail', 'app', 'static', 'cdn',
  'auth', 'login', 'signup', 'register', 'dashboard',
  'support', 'help', 'docs', 'status', 'health',
]);

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-11-20.acacia',
});

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
      },
    });
  }

  /**
   * Register a new tenant with an admin user, create a Stripe customer,
   * and return a Stripe Checkout URL for payment.
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
  }) {
    const { tenantName, slug, email, password, firstName, lastName, planSlug, billingInterval } = data;

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

    // Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      email: email.toLowerCase().trim(),
      name: tenantName,
      metadata: { tenantSlug: slug },
    });

    // Create tenant + admin user + subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug,
          plan: planSlug,
          isActive: false,
          settings: { currency: 'XOF', language: 'fr' },
        },
      });

      const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: email.toLowerCase().trim(),
          passwordHash,
          firstName,
          lastName,
          role: 'SUPERADMIN',
          status: 'LOCKED',
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          stripeCustomerId: stripeCustomer.id,
          status: 'PENDING',
          billingInterval,
        },
      });

      return tenant;
    });

    // Create Stripe Checkout Session
    const priceId = billingInterval === 'MONTHLY'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: config.stripe.cancelUrl,
      metadata: { tenantId: result.id },
    });

    logger.info('New tenant registered, awaiting payment', {
      tenantId: result.id,
      slug,
      planSlug,
    });

    return { tenantId: result.id, checkoutUrl: session.url };
  }

  /**
   * Handle Stripe webhook events.
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        config.stripe.webhookSecret,
      );
    } catch (err: any) {
      logger.error('Stripe webhook signature verification failed', { error: err.message });
      throw new AppError('Signature webhook invalide', 400, 'WEBHOOK_ERROR');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        logger.info(`Stripe webhook ignored: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) return;

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription || subscription.status === 'ACTIVE') return;

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { tenantId },
        data: {
          stripeSubscriptionId: session.subscription as string,
          status: 'ACTIVE',
        },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: { isActive: true },
      });

      // Unlock the superadmin user
      await tx.user.updateMany({
        where: { tenantId, role: 'SUPERADMIN', status: 'LOCKED' },
        data: { status: 'ACTIVE' },
      });
    });

    logger.info('Tenant activated after payment', { tenantId });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = invoice.subscription as string;
    if (!stripeSubscriptionId) return;

    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date((invoice.lines.data[0]?.period?.start ?? 0) * 1000),
        currentPeriodEnd: new Date((invoice.lines.data[0]?.period?.end ?? 0) * 1000),
      },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = invoice.subscription as string;
    if (!stripeSubscriptionId) return;

    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { status: 'PAST_DUE' },
    });

    logger.warn('Subscription payment failed', { stripeSubscriptionId });
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (!subscription) return;

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED' },
      });

      await tx.tenant.update({
        where: { id: subscription.tenantId },
        data: { isActive: false },
      });
    });

    logger.info('Subscription cancelled', { tenantId: subscription.tenantId });
  }
}

export const registrationService = new RegistrationService();
