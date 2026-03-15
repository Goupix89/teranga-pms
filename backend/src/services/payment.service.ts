import { PaymentMethod } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

export class PaymentService {
  /**
   * Record a payment for an invoice.
   */
  async create(tenantId: string, data: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    transactionUuid?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // Check idempotence for POS transactions
      if (data.transactionUuid) {
        const existing = await tx.payment.findUnique({
          where: { transactionUuid: data.transactionUuid },
        });

        if (existing) {
          return { payment: existing, alreadyProcessed: true };
        }
      }

      // Verify invoice belongs to tenant
      const invoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, tenantId },
      });

      if (!invoice) throw new NotFoundError('Facture');

      if (['CANCELLED', 'PAID'].includes(invoice.status)) {
        throw new ValidationError(`Paiement impossible : facture ${invoice.status}`);
      }

      // Verify amount doesn't exceed remaining balance
      const existingPayments = await tx.payment.aggregate({
        where: { invoiceId: data.invoiceId },
        _sum: { amount: true },
      });

      const totalPaid = existingPayments._sum.amount?.toNumber() ?? 0;
      const remaining = invoice.totalAmount.toNumber() - totalPaid;

      if (data.amount > remaining + 0.01) {
        throw new ValidationError(
          `Le montant (${data.amount}) dépasse le solde restant (${remaining.toFixed(2)})`
        );
      }

      // Create payment
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: data.invoiceId,
          amount: data.amount,
          method: data.method,
          reference: data.reference,
          transactionUuid: data.transactionUuid,
        },
      });

      // Update invoice status
      const newTotalPaid = totalPaid + data.amount;
      const invoiceTotal = invoice.totalAmount.toNumber();

      let newStatus = invoice.status;
      if (newTotalPaid >= invoiceTotal - 0.01) {
        newStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      if (newStatus !== invoice.status) {
        await tx.invoice.update({
          where: { id: data.invoiceId },
          data: {
            status: newStatus,
            ...(newStatus === 'PAID' && { paidAt: new Date() }),
          },
        });
      }

      logger.info('Payment recorded', {
        tenantId,
        paymentId: payment.id,
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
      });

      return { payment, alreadyProcessed: false };
    });
  }

  /**
   * List payments for an invoice.
   */
  async listByInvoice(tenantId: string, invoiceId: string) {
    const db = createTenantClient(tenantId);

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      select: { id: true },
    });

    if (!invoice) throw new NotFoundError('Facture');

    return prisma.payment.findMany({
      where: { invoiceId, tenantId },
      orderBy: { paidAt: 'desc' },
    });
  }

  /**
   * Process a POS transaction (from Android app).
   * Handles idempotence and stock decrementation.
   */
  async processPosTransaction(tenantId: string, userId: string, data: {
    transactionUuid: string;
    invoiceId: string;
    items: Array<{ articleId: string; quantity: number; unitPrice: number }>;
    totalAmount: number;
    timestamp: string;
  }) {
    // Check idempotence
    const existing = await prisma.payment.findUnique({
      where: { transactionUuid: data.transactionUuid },
    });

    if (existing) {
      return {
        id: existing.id,
        status: 'already_processed' as const,
        message: 'Transaction déjà enregistrée',
      };
    }

    // Validate server-side total
    const computedTotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    if (Math.abs(computedTotal - data.totalAmount) > 0.01) {
      throw new ValidationError(
        `Montant incohérent. Calculé: ${computedTotal.toFixed(2)}, Reçu: ${data.totalAmount.toFixed(2)}`
      );
    }

    // Validate timestamp window (±24h)
    const txTime = new Date(data.timestamp).getTime();
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;

    if (Math.abs(txTime - now) > windowMs) {
      throw new ValidationError('Horodatage de transaction hors fenêtre acceptable (±24h)');
    }

    // Process in transaction
    return prisma.$transaction(async (tx) => {
      // Re-check idempotence inside transaction
      const recheck = await tx.payment.findUnique({
        where: { transactionUuid: data.transactionUuid },
      });
      if (recheck) {
        return { id: recheck.id, status: 'already_processed' as const, message: 'Transaction déjà enregistrée' };
      }

      // Verify invoice
      const invoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, tenantId },
      });

      if (!invoice) throw new NotFoundError('Facture');

      // Create payment
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: data.invoiceId,
          amount: data.totalAmount,
          method: 'CASH',
          transactionUuid: data.transactionUuid,
          paidAt: new Date(data.timestamp),
        },
      });

      // Decrement stock for each article
      for (const item of data.items) {
        const article = await tx.article.findFirst({
          where: { id: item.articleId, tenantId },
        });

        if (!article) {
          logger.warn('POS: article not found, skipping stock update', {
            articleId: item.articleId,
            tenantId,
          });
          continue;
        }

        const newStock = article.currentStock - item.quantity;

        if (newStock < 0) {
          logger.warn('POS: negative stock detected', {
            articleId: article.id,
            articleName: article.name,
            previousStock: article.currentStock,
            newStock,
            tenantId,
          });
        }

        await tx.article.update({
          where: { id: article.id },
          data: { currentStock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            articleId: article.id,
            performedById: userId,
            type: 'SALE',
            quantity: -item.quantity,
            unitCost: item.unitPrice,
            previousStock: article.currentStock,
            newStock,
            reason: `Vente POS - ${data.transactionUuid.slice(0, 8)}`,
          },
        });
      }

      // Update invoice status
      const totalPaidAgg = await tx.payment.aggregate({
        where: { invoiceId: data.invoiceId },
        _sum: { amount: true },
      });

      const totalPaid = totalPaidAgg._sum.amount?.toNumber() ?? 0;
      const invoiceTotal = invoice.totalAmount.toNumber();

      if (totalPaid >= invoiceTotal - 0.01) {
        await tx.invoice.update({
          where: { id: data.invoiceId },
          data: { status: 'PAID', paidAt: new Date() },
        });
      } else if (totalPaid > 0) {
        await tx.invoice.update({
          where: { id: data.invoiceId },
          data: { status: 'PARTIALLY_PAID' },
        });
      }

      logger.info('POS transaction processed', {
        tenantId,
        paymentId: payment.id,
        transactionUuid: data.transactionUuid,
        totalAmount: data.totalAmount,
        itemCount: data.items.length,
      });

      return {
        id: payment.id,
        status: 'processed' as const,
        processedAt: new Date().toISOString(),
      };
    });
  }
}

export const paymentService = new PaymentService();
