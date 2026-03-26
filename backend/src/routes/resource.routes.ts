import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authenticateApiKey } from '../middlewares/auth.middleware';
import {
  requireSuperAdmin,
  requireAuthenticated,
  requireOwner,
  requireDAF,
  requireDAFOrManager,
  requireDAFOrManagerOrServer,
  requirePaymentRole,
  requireKitchenAccess,
  requireCleaningAccess,
  requireAnyEstablishmentRole,
  requireSelfOrRole,
  requireEstablishmentRole,
  getEstablishmentRole,
} from '../middlewares/rbac.middleware';
import { validate, validateQuery } from '../middlewares/validate.middleware';
import { parsePagination } from '../utils/helpers';
import * as v from '../validators';

import { userService, establishmentService, supplierService, articleService, categoryService } from '../services/crud.service';
import { roomService } from '../services/room.service';
import { reservationService } from '../services/reservation.service';
import { notificationService } from '../services/notification.service';
import { invoiceService } from '../services/invoice.service';
import { paymentService } from '../services/payment.service';
import { stockService } from '../services/stock.service';
import { orderService } from '../services/order.service';
import { approvalService } from '../services/approval.service';
import { cleaningService } from '../services/cleaning.service';
import { stockAlertService } from '../services/stock-alert.service';
import { memberService } from '../services/member.service';
import { channelSyncService } from '../services/channel-sync.service';
import { receiptService } from '../services/receipt.service';
// QR code and prisma for invoice QR endpoint
const QRCode = require('qrcode');
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import crypto from 'crypto';
import { config } from '../config';
import { encrypt, decrypt, maskSecret } from '../utils/encryption';
import { logger as appLogger } from '../utils/logger';

// Helper to wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// =============================================================================
// USERS
// =============================================================================
export const userRouter = Router();

userRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { role, status, search } = req.query as any;
    const data = await userService.list(req.user!.tenantId, params, {
      role, status, search,
      establishmentIds: req.user!.establishmentIds,
      requestingRole: req.user!.role,
    });
    res.json({ success: true, ...data });
  })
);

userRouter.get('/:id', authenticate, requireSelfOrRole('DAF', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = await userService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// DAF & MANAGER can create users (MANAGER creates under DAF approval)
userRouter.post('/', authenticate, requireDAFOrManager, validate(v.createUserSchema),
  asyncHandler(async (req, res) => {
    // SUPERADMIN bypasses all role restrictions
    const isSuperAdmin = req.user!.role === 'SUPERADMIN';
    const estId = req.body.establishmentIds?.[0];
    const estRole = isSuperAdmin ? undefined : (estId ? getEstablishmentRole(req, estId) : null);
    const data = await userService.create(req.user!.tenantId, req.body, estRole ?? undefined);
    res.status(201).json({ success: true, data });
  })
);

// Approve a pending user (DAF only)
userRouter.post('/:id/approve', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const data = await userService.approve(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

userRouter.patch('/:id', authenticate, requireSelfOrRole('OWNER', 'DAF'),
  validate(v.updateUserSchema),
  asyncHandler(async (req, res) => {
    const estId = req.body.establishmentIds?.[0];
    const estRole = estId ? getEstablishmentRole(req, estId) : null;
    const data = await userService.update(req.user!.tenantId, req.params.id, req.body, estRole);
    res.json({ success: true, data });
  })
);

userRouter.delete('/:id', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    await userService.archive(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Utilisateur archivé' });
  })
);

// =============================================================================
// ESTABLISHMENTS
// =============================================================================
export const establishmentRouter = Router();

establishmentRouter.get('/', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const result = await establishmentService.list(req.user!.tenantId, params, req.user!.establishmentIds);
    // Inject the current user's establishment role into each establishment
    const memberships = req.user?.memberships || [];
    const data = (result.data || []).map((est: any) => {
      const membership = memberships.find((m) => m.establishmentId === est.id);
      return { ...est, currentUserRole: membership?.role || null };
    });
    res.json({ success: true, ...result, data });
  })
);

establishmentRouter.get('/:id', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const data = await establishmentService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

establishmentRouter.post('/', authenticate, requireSuperAdmin, validate(v.createEstablishmentSchema),
  asyncHandler(async (req, res) => {
    const data = await establishmentService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

establishmentRouter.patch('/:id', authenticate, requireSuperAdmin, validate(v.updateEstablishmentSchema),
  asyncHandler(async (req, res) => {
    const data = await establishmentService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

establishmentRouter.delete('/:id', authenticate, requireSuperAdmin,
  asyncHandler(async (req, res) => {
    await establishmentService.delete(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Établissement désactivé' });
  })
);

// =============================================================================
// ESTABLISHMENT MEMBERS
// =============================================================================
export const memberRouter = Router();

memberRouter.get('/:establishmentId/members', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await memberService.list(req.user!.tenantId, req.params.establishmentId);
    res.json({ success: true, data });
  })
);

memberRouter.post('/:establishmentId/members', authenticate, requireDAF, validate(v.addMemberSchema),
  asyncHandler(async (req, res) => {
    const data = await memberService.add(req.user!.tenantId, req.params.establishmentId, req.body);
    res.status(201).json({ success: true, data });
  })
);

memberRouter.patch('/:establishmentId/members/:memberId', authenticate, requireDAF, validate(v.updateMemberRoleSchema),
  asyncHandler(async (req, res) => {
    const data = await memberService.updateRole(
      req.user!.tenantId, req.params.establishmentId, req.params.memberId, req.body.role
    );
    res.json({ success: true, data });
  })
);

memberRouter.delete('/:establishmentId/members/:memberId', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    await memberService.remove(req.user!.tenantId, req.params.establishmentId, req.params.memberId);
    res.json({ success: true, message: 'Membre retiré' });
  })
);

// =============================================================================
// ROOMS
// =============================================================================
export const roomRouter = Router();

roomRouter.get('/', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { status, type, establishmentId, search, minPrice, maxPrice } = req.query as any;
    const data = await roomService.list(req.user!.tenantId, params, {
      status, type, establishmentId, search,
      establishmentIds: req.user!.establishmentIds,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
    res.json({ success: true, ...data });
  })
);

roomRouter.get('/:id', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const data = await roomService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

roomRouter.post('/', authenticate, requireDAFOrManager, validate(v.createRoomSchema),
  asyncHandler(async (req, res) => {
    const estRole = getEstablishmentRole(req, req.body.establishmentId);

    // MANAGER room creation requires DAF approval
    if (estRole === 'MANAGER') {
      const approval = await approvalService.create(req.user!.tenantId, {
        establishmentId: req.body.establishmentId,
        type: 'ROOM_CREATION',
        requestedById: req.user!.id,
        payload: req.body,
      });
      return res.status(202).json({
        success: true,
        message: 'Création soumise à validation du DAF',
        data: approval,
      });
    }

    const data = await roomService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

roomRouter.patch('/:id', authenticate, requireDAFOrManager, validate(v.updateRoomSchema),
  asyncHandler(async (req, res) => {
    const data = await roomService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

roomRouter.patch('/:id/status', authenticate, requireAnyEstablishmentRole, validate(v.updateRoomStatusSchema),
  asyncHandler(async (req, res) => {
    const data = await roomService.updateStatus(req.user!.tenantId, req.params.id, req.body.status);
    res.json({ success: true, data });
  })
);

roomRouter.delete('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    await roomService.delete(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Chambre désactivée' });
  })
);

// =============================================================================
// RESERVATIONS
// =============================================================================
export const reservationRouter = Router();

reservationRouter.get('/', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { status, roomId, from, to, source, search } = req.query as any;
    const data = await reservationService.list(req.user!.tenantId, params, {
      status, roomId, from, to, source, search,
      establishmentIds: req.user!.establishmentIds,
    });
    res.json({ success: true, ...data });
  })
);

// Reservation receipt PDF — must be before /:id to avoid capture
reservationRouter.get('/:id/receipt', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const pdfBuffer = await receiptService.generateReservationPdf(req.user!.tenantId, req.params.id);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="recu-reservation-${req.params.id}.pdf"`);
    res.end(pdfBuffer);
  })
);

reservationRouter.get('/:id', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const data = await reservationService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// DAF + MANAGER can create reservations
reservationRouter.post('/', authenticate, requireDAFOrManager, validate(v.createReservationSchema),
  asyncHandler(async (req, res) => {
    const data = await reservationService.create(req.user!.tenantId, req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  })
);

// MANAGER can request date-only modifications (requires DAF approval)
reservationRouter.patch('/:id/dates', authenticate, requireEstablishmentRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const { checkIn, checkOut } = req.body;

    if (!checkIn && !checkOut) {
      return res.status(400).json({ success: false, error: 'checkIn ou checkOut requis' });
    }

    // Fetch the reservation to determine establishment context
    const reservation = await reservationService.getById(req.user!.tenantId, req.params.id);
    // Derive establishmentId from user's first membership as fallback
    const establishmentId = req.body.establishmentId || req.user!.establishmentIds?.[0];

    const approval = await approvalService.create(req.user!.tenantId, {
      establishmentId,
      type: 'RESERVATION_MODIFICATION',
      requestedById: req.user!.id,
      payload: { checkIn, checkOut },
      targetId: req.params.id,
    });

    res.status(202).json({
      success: true,
      message: 'Modification de dates soumise à validation du DAF',
      data: approval,
    });
  })
);

// MANAGER modifications require DAF approval → handled in approval flow
reservationRouter.patch('/:id', authenticate, requireDAF, validate(v.updateReservationSchema),
  asyncHandler(async (req, res) => {
    const data = await reservationService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

reservationRouter.post('/:id/check-in', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const data = await reservationService.checkIn(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

reservationRouter.post('/:id/check-out', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const data = await reservationService.checkOut(req.user!.tenantId, req.params.id);

    // After checkout, set the room status to CLEANING so it appears in cleaning queue
    try {
      const reservation = await reservationService.getById(req.user!.tenantId, req.params.id);
      if (reservation?.roomId) {
        await roomService.updateStatus(req.user!.tenantId, reservation.roomId, 'CLEANING');

        // Notify cleaners
        const room = reservation.room;
        const estId = room?.establishment?.name ? reservation.room?.establishment : null;
        // Get establishmentId from the room
        const roomData = await prisma.room.findUnique({ where: { id: reservation.roomId }, select: { establishmentId: true, number: true } });
        if (roomData?.establishmentId) {
          notificationService.notifyRole({
            tenantId: req.user!.tenantId,
            establishmentId: roomData.establishmentId,
            roles: ['CLEANER'],
            type: 'ROOM_CHECKOUT',
            title: 'Chambre a nettoyer',
            message: `La chambre ${roomData.number} a ete liberee et necessite un nettoyage.`,
            data: { roomId: reservation.roomId, roomNumber: roomData.number },
          }).catch(() => {}); // Non-blocking
        }
      }
    } catch (_e) {
      // Non-blocking: if setting cleaning status fails, checkout still succeeded
    }

    res.json({ success: true, data });
  })
);

reservationRouter.post('/:id/cancel', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await reservationService.cancel(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// ORDERS
// =============================================================================
export const orderRouter = Router();

orderRouter.get('/', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { establishmentId, status, createdById, from, to } = req.query as any;
    const data = await orderService.list(req.user!.tenantId, params, {
      establishmentId, status, createdById, from, to,
    });
    res.json({ success: true, ...data });
  })
);

orderRouter.get('/kitchen/:establishmentId', authenticate, requireKitchenAccess,
  asyncHandler(async (req, res) => {
    const data = await orderService.getKitchenOrders(req.user!.tenantId, req.params.establishmentId);
    res.json({ success: true, data });
  })
);

orderRouter.get('/stats/:establishmentId', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const userId = req.query.userId as string | undefined;
    const data = await orderService.getStats(req.user!.tenantId, req.params.establishmentId, userId);
    res.json({ success: true, data });
  })
);

orderRouter.get('/:id', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const data = await orderService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// Receipt PDF
orderRouter.get('/:id/receipt', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const pdfBuffer = await receiptService.generatePdf(req.user!.tenantId, req.params.id);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="recu-${req.params.id}.pdf"`);
    res.end(pdfBuffer);
  })
);

// Servers create orders
orderRouter.post('/', authenticate, requireDAFOrManagerOrServer, validate(v.createOrderSchema),
  asyncHandler(async (req, res) => {
    const data = await orderService.create(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  })
);

// Cooks mark IN_PROGRESS/READY, servers mark SERVED, DAF/MANAGER can cancel
orderRouter.patch('/:id/status', authenticate, requireEstablishmentRole('DAF', 'MANAGER', 'SERVER', 'COOK'),
  validate(v.updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const data = await orderService.updateStatus(req.user!.tenantId, req.params.id, req.body.status, req.user!.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// INVOICES
// =============================================================================
export const invoiceRouter = Router();

invoiceRouter.get('/', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { status, reservationId, search } = req.query as any;
    const data = await invoiceService.list(req.user!.tenantId, params, {
      status, reservationId, search,
      establishmentIds: req.user!.establishmentIds,
    });
    res.json({ success: true, ...data });
  })
);

invoiceRouter.get('/:id', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const data = await invoiceService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

invoiceRouter.post('/', authenticate, requireDAFOrManagerOrServer, validate(v.createInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.create(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  })
);

invoiceRouter.patch('/:id', authenticate, requireDAFOrManager, validate(v.updateInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

invoiceRouter.post('/:id/issue', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await invoiceService.issue(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

invoiceRouter.post('/:id/cancel', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const data = await invoiceService.cancel(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// Simulate payment (dev/test only) — marks invoice as PAID
invoiceRouter.post('/:id/simulate-payment', authenticate,
  asyncHandler(async (req, res) => {
    const invoice = await invoiceService.getById(req.user!.tenantId, req.params.id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Facture introuvable' });
      return;
    }
    if (['PAID', 'CANCELLED'].includes(invoice.status)) {
      res.status(400).json({ success: false, error: `Facture déjà ${invoice.status === 'PAID' ? 'payée' : 'annulée'}` });
      return;
    }

    // Find linked order to get paymentMethod
    const order = await prisma.order.findFirst({
      where: { invoiceId: invoice.id, tenantId: req.user!.tenantId },
      select: { id: true, paymentMethod: true },
    });

    const method = (order?.paymentMethod || req.body.method || 'CASH') as any;

    // Create payment record for the full amount
    const { payment } = await paymentService.create(req.user!.tenantId, {
      invoiceId: invoice.id,
      amount: Number(invoice.totalAmount),
      method,
      reference: `SIM-${Date.now()}`,
    });

    // Also mark the linked order as SERVED if still pending
    if (order) {
      await prisma.order.updateMany({
        where: { id: order.id, status: { notIn: ['SERVED', 'CANCELLED'] } },
        data: { status: 'SERVED', servedAt: new Date() },
      });
    }

    res.json({
      success: true,
      message: 'Paiement simulé avec succès',
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: Number(invoice.totalAmount),
        method,
      },
    });
  })
);

// QR code for invoice payment
invoiceRouter.get('/:id/qrcode', authenticate,
  asyncHandler(async (req, res) => {
    const invoice = await invoiceService.getById(req.user!.tenantId, req.params.id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Facture introuvable' });
      return;
    }

    // Find the order linked to this invoice to get paymentMethod
    const order = await prisma.order.findFirst({
      where: { invoiceId: invoice.id, tenantId: req.user!.tenantId },
      select: { paymentMethod: true, orderNumber: true, tableNumber: true },
    });

    // Check existing payments to detect paymentMethod (e.g., FEDAPAY payment already recorded)
    const existingPayment = await prisma.payment.findFirst({
      where: { invoiceId: invoice.id },
      select: { method: true },
      orderBy: { paidAt: 'desc' },
    });

    const paymentMethod = order?.paymentMethod || existingPayment?.method || (req.query.paymentMethod as string) || 'MOBILE_MONEY';

    // FedaPay: create a transaction and get checkout URL
    let fedapayCheckoutUrl: string | undefined;
    if (paymentMethod === 'FEDAPAY') {
      appLogger.info('FedaPay QR: entering FedaPay block', { paymentMethod, invoiceId: invoice.id });
      // Get FedaPay config: tenant settings first, then global env fallback
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.user!.tenantId },
        select: { settings: true },
      });
      const tenantSettings = (tenant?.settings as Record<string, any>) || {};

      let fedapayKey = '';
      let isSandbox = true;
      let callbackUrl = '';

      if (tenantSettings.fedapaySecretKey) {
        fedapayKey = decrypt(tenantSettings.fedapaySecretKey);
        isSandbox = tenantSettings.fedapaySandbox !== false;
        callbackUrl = tenantSettings.fedapayCallbackUrl || '';
      } else if (config.fedapay.secretKey) {
        fedapayKey = config.fedapay.secretKey;
        isSandbox = config.fedapay.isSandbox;
        callbackUrl = config.fedapay.callbackUrl;
      }

      if (fedapayKey) {
        try {
          const apiBase = isSandbox
            ? 'https://sandbox-api.fedapay.com'
            : 'https://api.fedapay.com';

          // Create FedaPay transaction
          const txnResponse = await fetch(`${apiBase}/v1/transactions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${fedapayKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              description: `Paiement facture ${invoice.invoiceNumber}`,
              amount: Number(invoice.totalAmount),
              currency: { iso: invoice.currency || 'XOF' },
              callback_url: callbackUrl,
              custom_metadata: {
                invoice_id: invoice.id,
                invoice_number: invoice.invoiceNumber,
                reservation_id: invoice.reservationId || null,
                tenant_id: req.user!.tenantId,
              },
            }),
          });

          const txnData = await txnResponse.json() as any;
          appLogger.info('FedaPay txn response', { status: txnResponse.status, body: JSON.stringify(txnData).substring(0, 500) });

          if (txnResponse.ok || txnResponse.status === 201) {
            // FedaPay response can be {v1: {transaction: {id}}} or {transaction: {id}}
            const transactionId = txnData?.v1?.transaction?.id || txnData?.transaction?.id;

            if (transactionId) {
              // Generate payment token/URL
              const tokenResponse = await fetch(`${apiBase}/v1/transactions/${transactionId}/token`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${fedapayKey}`,
                  'Content-Type': 'application/json',
                },
              });

              const tokenData = await tokenResponse.json() as any;
              appLogger.info('FedaPay token response', { status: tokenResponse.status, body: JSON.stringify(tokenData).substring(0, 300) });

              if (tokenResponse.ok || tokenResponse.status === 201) {
                const token = tokenData?.token;
                if (token) {
                  fedapayCheckoutUrl = isSandbox
                    ? `https://sandbox-checkout.fedapay.com/checkout/${token}`
                    : `https://checkout.fedapay.com/checkout/${token}`;
                }
              }
            } else {
              appLogger.error('FedaPay: no transaction ID in response', { body: JSON.stringify(txnData).substring(0, 300) });
            }
          } else {
            appLogger.error('FedaPay txn creation failed', { status: txnResponse.status, body: JSON.stringify(txnData).substring(0, 300) });
          }
        } catch (err) {
          appLogger.error('FedaPay transaction creation error', { error: String(err) });
          // Continue without FedaPay URL — fallback to regular QR
        }
      }
    }

    // Build QR code: for FedaPay, encode the checkout URL; otherwise, encode JSON payload
    const qrContent = fedapayCheckoutUrl || JSON.stringify({
      type: 'TERANGA_PMS_PAYMENT',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.totalAmount),
      currency: invoice.currency || 'XOF',
      paymentMethod,
      orderNumber: order?.orderNumber,
      tableNumber: order?.tableNumber,
      status: invoice.status,
    });

    const qrDataUrl = await QRCode.toDataURL(qrContent, {
      width: 400,
      margin: 2,
      color: { dark: '#3E2723', light: '#FFF8E1' },
    });

    res.json({
      success: true,
      data: {
        qrCode: qrDataUrl,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
          status: invoice.status,
          currency: invoice.currency || 'XOF',
        },
        paymentMethod,
        paymentLabel: paymentMethod === 'MOOV_MONEY' ? 'Flooz' : paymentMethod === 'MIXX_BY_YAS' ? 'Yas' : paymentMethod === 'FEDAPAY' ? 'FedaPay' : paymentMethod,
        fedapayCheckoutUrl,
      },
    });
  })
);

// Invoice PDF
invoiceRouter.get('/:id/pdf', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const pdfBuffer = await receiptService.generateInvoicePdf(req.user!.tenantId, req.params.id);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="facture-${req.params.id}.pdf"`);
    res.end(pdfBuffer);
  })
);

// =============================================================================
// PAYMENTS
// =============================================================================
export const paymentRouter = Router();

paymentRouter.post('/', authenticate, requirePaymentRole, validate(v.createPaymentSchema),
  asyncHandler(async (req, res) => {
    const { payment, alreadyProcessed } = await paymentService.create(req.user!.tenantId, req.body);
    res.status(alreadyProcessed ? 200 : 201).json({ success: true, data: payment });
  })
);

paymentRouter.get('/invoice/:invoiceId', authenticate, requirePaymentRole,
  asyncHandler(async (req, res) => {
    const data = await paymentService.listByInvoice(req.user!.tenantId, req.params.invoiceId);
    res.json({ success: true, data });
  })
);

// =============================================================================
// ARTICLES
// =============================================================================
export const articleRouter = Router();

articleRouter.get('/', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { categoryId, search, lowStock, menuOnly, establishmentId } = req.query as any;
    // OWNER/DAF/Manager can see unapproved articles
    const isDAFOrManager = req.user?.role === 'SUPERADMIN' || req.user?.memberships?.some(
      (m) => ['OWNER', 'DAF', 'MANAGER'].includes(m.role)
    );
    // Scope articles to the requested establishment (or user's first establishment)
    const resolvedEstId = establishmentId || req.user?.establishmentIds?.[0];
    const data = await articleService.list(req.user!.tenantId, params, {
      categoryId, search, lowStock: lowStock === 'true',
      includeUnapproved: !!isDAFOrManager,
      menuOnly: menuOnly === 'true',
      establishmentId: resolvedEstId,
    });
    res.json({ success: true, ...data });
  })
);

articleRouter.get('/low-stock', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await articleService.getLowStock(req.user!.tenantId);
    res.json({ success: true, data });
  })
);

articleRouter.get('/:id', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const data = await articleService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// DAF and MANAGER can create articles — Manager articles require DAF approval
articleRouter.post('/', authenticate, requireDAFOrManager, validate(v.createArticleSchema),
  asyncHandler(async (req, res) => {
    const userRole = req.user?.role;
    const { establishmentId: estId, ...articleData } = req.body;
    const resolvedEstId = estId || req.query.establishmentId as string || req.user?.establishmentIds?.[0] || '';

    // Determine user's establishment role
    let estRole: string | null = null;
    if (userRole === 'SUPERADMIN') {
      estRole = 'OWNER';
    } else {
      const membership = req.user?.memberships?.find(
        (m) => resolvedEstId ? m.establishmentId === resolvedEstId : true
      );
      estRole = membership?.role || null;
    }

    if (estRole === 'MANAGER' || estRole === 'DAF') {
      // Manager and DAF create articles requiring approval (from DAF/OWNER or OWNER respectively)
      const article = await articleService.create(req.user!.tenantId, {
        ...articleData,
        establishmentId: resolvedEstId || undefined,
        isApproved: false,
        createdById: req.user!.id,
      });
      await approvalService.create(req.user!.tenantId, {
        establishmentId: resolvedEstId,
        type: 'ARTICLE_CREATION',
        requestedById: req.user!.id,
        payload: {
          articleId: article.id,
          name: article.name,
          unitPrice: Number(article.unitPrice),
          costPrice: Number(article.costPrice),
          categoryId: article.categoryId,
          categoryName: article.category?.name || '',
          description: article.description || '',
          imageUrl: article.imageUrl || '',
          currentStock: article.currentStock,
          minimumStock: article.minimumStock,
          unit: article.unit,
        },
        targetId: article.id,
      });
      res.status(201).json({ success: true, data: article, requiresApproval: true });
    } else {
      // OWNER (and SUPERADMIN) creates article directly as approved
      const data = await articleService.create(req.user!.tenantId, {
        ...articleData,
        establishmentId: resolvedEstId || undefined,
        isApproved: true,
        createdById: req.user!.id,
      });
      res.status(201).json({ success: true, data });
    }
  })
);

articleRouter.patch('/:id', authenticate, requireDAF, validate(v.updateArticleSchema),
  asyncHandler(async (req, res) => {
    const data = await articleService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

// =============================================================================
// CATEGORIES
// =============================================================================
export const categoryRouter = Router();

categoryRouter.get('/', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const { establishmentId } = req.query as any;
    const resolvedEstId = establishmentId || req.user?.establishmentIds?.[0];
    const data = await categoryService.list(req.user!.tenantId, resolvedEstId);
    res.json({ success: true, data });
  })
);

categoryRouter.post('/', authenticate, requireDAF, validate(v.createCategorySchema),
  asyncHandler(async (req, res) => {
    const establishmentId = req.body.establishmentId || req.user?.establishmentIds?.[0];
    const data = await categoryService.create(req.user!.tenantId, { ...req.body, establishmentId });
    res.status(201).json({ success: true, data });
  })
);

categoryRouter.patch('/:id', authenticate, requireDAF, validate(v.updateCategorySchema),
  asyncHandler(async (req, res) => {
    const data = await categoryService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

// =============================================================================
// STOCK MOVEMENTS
// =============================================================================
export const stockMovementRouter = Router();

stockMovementRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { articleId, type, from, to, pendingApproval } = req.query as any;
    const data = await stockService.listMovements(req.user!.tenantId, params, {
      articleId, type, from, to,
      pendingApproval: pendingApproval === 'true',
    });
    res.json({ success: true, ...data });
  })
);

stockMovementRouter.post('/', authenticate, requireDAFOrManager, validate(v.createStockMovementSchema),
  asyncHandler(async (req, res) => {
    const estId = req.body.establishmentId;
    const estRole = estId ? getEstablishmentRole(req, estId) : null;

    // MANAGER stock movements require DAF approval
    if (estRole === 'MANAGER') {
      const movement = await stockService.createMovement(req.user!.tenantId, req.user!.id, {
        ...req.body,
        requiresApproval: true,
      });

      const approval = await approvalService.create(req.user!.tenantId, {
        establishmentId: estId,
        type: 'STOCK_MOVEMENT',
        requestedById: req.user!.id,
        payload: req.body,
        targetId: (movement as any).id || (movement as any).data?.id,
      });

      return res.status(202).json({
        success: true,
        message: 'Mouvement de stock soumis à validation du DAF',
        data: approval,
      });
    }

    const data = await stockService.createMovement(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, ...data });
  })
);

stockMovementRouter.post('/:id/approve', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const data = await stockService.approveMovement(req.user!.tenantId, req.params.id, req.user!.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// STOCK ALERTS
// =============================================================================
export const stockAlertRouter = Router();

stockAlertRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { establishmentId, isResolved } = req.query as any;
    const data = await stockAlertService.list(req.user!.tenantId, params, {
      establishmentId,
      isResolved: isResolved !== undefined ? isResolved === 'true' : undefined,
    });
    res.json({ success: true, ...data });
  })
);

// MANAGER creates stock alerts to notify DAF
stockAlertRouter.post('/', authenticate, requireDAFOrManager, validate(v.createStockAlertSchema),
  asyncHandler(async (req, res) => {
    const data = await stockAlertService.create(req.user!.tenantId, {
      ...req.body,
      createdById: req.user!.id,
    });
    res.status(201).json({ success: true, data });
  })
);

// DAF resolves alerts
stockAlertRouter.post('/:id/resolve', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const data = await stockAlertService.resolve(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

stockAlertRouter.get('/count/:establishmentId', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const count = await stockAlertService.getUnresolvedCount(req.user!.tenantId, req.params.establishmentId);
    res.json({ success: true, data: { count } });
  })
);

// =============================================================================
// APPROVAL REQUESTS
// =============================================================================
export const approvalRouter = Router();

approvalRouter.get('/', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { establishmentId, status, type } = req.query as any;
    const data = await approvalService.list(req.user!.tenantId, params, {
      establishmentId, status, type,
    });
    res.json({ success: true, ...data });
  })
);

approvalRouter.post('/', authenticate, requireDAFOrManager, validate(v.createApprovalSchema),
  asyncHandler(async (req, res) => {
    const data = await approvalService.create(req.user!.tenantId, {
      ...req.body,
      requestedById: req.user!.id,
    });
    res.status(201).json({ success: true, data });
  })
);

approvalRouter.post('/:id/approve', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const data = await approvalService.approve(req.user!.tenantId, req.params.id, req.user!.id);
    res.json({ success: true, data });
  })
);

approvalRouter.post('/:id/reject', authenticate, requireDAF, validate(v.rejectApprovalSchema),
  asyncHandler(async (req, res) => {
    const data = await approvalService.reject(req.user!.tenantId, req.params.id, req.user!.id, req.body.reason);
    res.json({ success: true, data });
  })
);

approvalRouter.get('/pending-count/:establishmentId', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const count = await approvalService.getPendingCount(req.user!.tenantId, req.params.establishmentId);
    res.json({ success: true, data: { count } });
  })
);

// =============================================================================
// CLEANING SESSIONS
// =============================================================================
export const cleaningRouter = Router();

cleaningRouter.get('/', authenticate, requireCleaningAccess,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { establishmentId, cleanerId, status, roomId, from, to } = req.query as any;
    const data = await cleaningService.list(req.user!.tenantId, params, {
      establishmentId, cleanerId, status, roomId, from, to,
    });
    res.json({ success: true, ...data });
  })
);

cleaningRouter.get('/active/:establishmentId', authenticate, requireCleaningAccess,
  asyncHandler(async (req, res) => {
    const data = await cleaningService.getActiveSessions(req.user!.tenantId, req.params.establishmentId);
    res.json({ success: true, data });
  })
);

// Cleaner clocks in (only CLEANER role — MANAGER/DAF cannot clean)
cleaningRouter.post('/clock-in', authenticate, requireEstablishmentRole('CLEANER'), validate(v.clockInSchema),
  asyncHandler(async (req, res) => {
    const data = await cleaningService.clockIn(req.user!.tenantId, {
      ...req.body,
      cleanerId: req.user!.id,
    });
    res.status(201).json({ success: true, data });
  })
);

// Cleaner clocks out
cleaningRouter.post('/:id/clock-out', authenticate, requireCleaningAccess,
  asyncHandler(async (req, res) => {
    const data = await cleaningService.clockOut(req.user!.tenantId, req.params.id, req.user!.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// SUPPLIERS
// =============================================================================
export const supplierRouter = Router();

supplierRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const data = await supplierService.list(req.user!.tenantId, params, req.query.search as string);
    res.json({ success: true, ...data });
  })
);

supplierRouter.get('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await supplierService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

supplierRouter.post('/', authenticate, requireDAF, validate(v.createSupplierSchema),
  asyncHandler(async (req, res) => {
    const data = await supplierService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

supplierRouter.patch('/:id', authenticate, requireDAF, validate(v.updateSupplierSchema),
  asyncHandler(async (req, res) => {
    const data = await supplierService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

supplierRouter.delete('/:id', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    await supplierService.delete(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Fournisseur désactivé' });
  })
);

// =============================================================================
// INTEGRATION ENDPOINTS
// =============================================================================

/** Notify WordPress/external system when a payment is recorded for a channel-manager reservation */
async function notifyExternalPayment(tenantId: string, invoiceId: string, paymentMethod: string, amount: number) {
  try {
    // Find the reservation linked to this invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { reservationId: true },
    });
    if (!invoice?.reservationId) return;

    const reservation = await prisma.reservation.findFirst({
      where: { id: invoice.reservationId, source: { in: ['CHANNEL_MANAGER', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB'] } },
      select: { id: true, externalRef: true, guestName: true, checkIn: true, checkOut: true, source: true },
    });
    if (!reservation?.externalRef) return;

    // Get tenant webhook URL from settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, any>) || {};
    const webhookUrl = settings.paymentWebhookUrl;
    if (!webhookUrl) return;

    // Send payment notification to external system
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'payment.completed',
        reservationId: reservation.id,
        externalRef: reservation.externalRef,
        guestName: reservation.guestName,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        paymentMethod,
        amount,
        invoiceId,
        paidAt: new Date().toISOString(),
      }),
    }).catch(() => {}); // Fire and forget
  } catch {}
}

export const integrationRouter = Router();

// GET /api/availability.json
integrationRouter.get('/availability.json', authenticate,
  asyncHandler(async (req, res) => {
    const { from, to, establishmentId } = req.query as any;
    const data = await reservationService.getAvailability(req.user!.tenantId, from, to, establishmentId);
    res.set('Cache-Control', 'private, max-age=300');
    res.json(data);
  })
);

// GET /api/availability.ics
integrationRouter.get('/availability.ics', authenticate,
  asyncHandler(async (req, res) => {
    const ical = await reservationService.getAvailabilityIcal(req.user!.tenantId);
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="availability.ics"');
    res.send(ical);
  })
);

// POST /api/external-bookings (API Key auth for channel managers)
integrationRouter.post('/external-bookings', authenticateApiKey, validate(v.externalBookingSchema),
  asyncHandler(async (req, res) => {
    const { room, start, end, guest, guestEmail, guestPhone, source, externalRef, paymentMethod, fedapayTransactionId, numberOfGuests, amountPaid } = req.body;

    // Resolve room by number
    const { prisma: db } = await import('../utils/prisma');
    const roomEntity = await db.room.findFirst({
      where: { tenantId: req.tenantId!, number: room, isActive: true },
      include: { establishment: { select: { name: true } } },
    });

    if (!roomEntity) {
      return res.status(404).json({ success: false, error: `Chambre ${room} introuvable` });
    }

    // Find a tenant member (OWNER preferred) for invoice createdById
    const tenantMember = await db.user.findFirst({
      where: { tenantId: req.tenantId!, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const reservation = await reservationService.create(req.tenantId!, {
      roomId: roomEntity.id,
      guestName: guest,
      guestEmail,
      guestPhone,
      checkIn: start,
      checkOut: end,
      numberOfGuests: numberOfGuests || 1,
      source: source || 'CHANNEL_MANAGER',
      externalRef,
      paymentMethod: paymentMethod || (fedapayTransactionId ? 'FEDAPAY' : undefined),
    }, tenantMember?.id); // Pass userId to auto-generate invoice

    // Update invoice notes with room and guest details
    if (reservation.invoiceId) {
      const checkInDate = new Date(start);
      const checkOutDate = new Date(end);
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      await db.invoice.update({
        where: { id: reservation.invoiceId },
        data: {
          notes: `Hébergement ${guest} — Chambre ${room} (${roomEntity.type || 'Standard'}) — ${roomEntity.establishment?.name || ''} — ${nights} nuit${nights > 1 ? 's' : ''} (${start} au ${end})`,
        },
      });
    }

    // If FedaPay transaction ID provided, auto-record payment
    let paymentId: string | undefined;
    let paymentStatus = 'PENDING';
    if (fedapayTransactionId && reservation.invoiceId) {
      try {
        const invoice = await db.invoice.findFirst({
          where: { id: reservation.invoiceId, tenantId: req.tenantId! },
        });
        if (invoice) {
          // Use amountPaid if provided (e.g., 60% deposit), otherwise use full amount
          const payAmount = amountPaid && amountPaid > 0
            ? Math.min(amountPaid, invoice.totalAmount.toNumber())
            : invoice.totalAmount.toNumber();

          const result = await paymentService.create(req.tenantId!, {
            invoiceId: reservation.invoiceId,
            amount: payAmount,
            method: 'FEDAPAY',
            reference: fedapayTransactionId,
            transactionUuid: `fedapay_${fedapayTransactionId}`,
          });
          paymentId = result.payment.id;

          // Determine payment status based on amount paid
          if (payAmount >= invoice.totalAmount.toNumber() - 0.01) {
            paymentStatus = 'PAID';
          } else {
            paymentStatus = 'PARTIALLY_PAID';
          }
        }
      } catch (e: any) {
        // Payment recording failed but reservation was created — log and continue
        const { logger } = await import('../utils/logger');
        logger.warn('Failed to auto-record FedaPay payment for external booking', {
          reservationId: reservation.id,
          fedapayTransactionId,
          error: e.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: reservation.id,
        room: room,
        roomType: roomEntity.type,
        establishmentName: roomEntity.establishment?.name,
        guestName: guest,
        guestEmail,
        guestPhone,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        status: reservation.status,
        totalPrice: reservation.totalPrice ? Number(reservation.totalPrice) : undefined,
        invoiceId: reservation.invoiceId,
        paymentId,
        amountPaid: amountPaid || (paymentId ? Number(reservation.totalPrice) : 0),
        paymentStatus,
      },
    });
  })
);

// POST /api/pos/transactions (POS app)
integrationRouter.post('/pos/transactions', authenticate, requirePaymentRole, validate(v.posTransactionSchema),
  asyncHandler(async (req, res) => {
    const result = await paymentService.processPosTransaction(
      req.user!.tenantId,
      req.user!.id,
      req.body
    );

    res.status(result.status === 'already_processed' ? 200 : 201).json({
      success: true,
      ...result,
    });
  })
);

// =============================================================================
// CHANNEL SYNC (iCal)
// =============================================================================
export const channelRouter = Router();

// GET /api/channels — list connections
channelRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const { roomId, establishmentId } = req.query as any;
    const data = await channelSyncService.listConnections(req.user!.tenantId, { roomId, establishmentId });
    res.json({ success: true, data });
  })
);

// GET /api/channels/:id — detail with sync logs
channelRouter.get('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await channelSyncService.getConnectionWithLogs(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// POST /api/channels — create connection
channelRouter.post('/', authenticate, requireDAFOrManager, validate(v.createChannelSchema),
  asyncHandler(async (req, res) => {
    const data = await channelSyncService.createConnection(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

// PATCH /api/channels/:id — update
channelRouter.patch('/:id', authenticate, requireDAFOrManager, validate(v.updateChannelSchema),
  asyncHandler(async (req, res) => {
    const data = await channelSyncService.updateConnection(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

// DELETE /api/channels/:id — remove
channelRouter.delete('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    await channelSyncService.deleteConnection(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Connexion supprimée' });
  })
);

// POST /api/channels/:id/sync — manual inbound sync
channelRouter.post('/:id/sync', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const result = await channelSyncService.syncInbound(req.params.id);
    res.json({ success: true, data: result });
  })
);

// POST /api/channels/:id/regenerate-token — regenerate export token
channelRouter.post('/:id/regenerate-token', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await channelSyncService.regenerateToken(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// API KEYS MANAGEMENT
// =============================================================================
export const apiKeyRouter = Router();

// GET /api/api-keys — list tenant's API keys
apiKeyRouter.get('/', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const keys = await prisma.apiKey.findMany({
      where: { tenantId: req.user!.tenantId },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        allowedIps: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: keys });
  })
);

// POST /api/api-keys — create a new API key
apiKeyRouter.post('/', authenticate, requireDAF, validate(v.createApiKeySchema),
  asyncHandler(async (req, res) => {
    const { name, expiresInDays, allowedIps } = req.body;

    // Generate a secure random key
    const rawKey = `tpms_${crypto.randomBytes(32).toString('hex')}`;
    const prefix = rawKey.slice(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 90));

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: req.user!.tenantId,
        name,
        keyHash,
        prefix,
        expiresAt,
        allowedIps: allowedIps || [],
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        expiresAt: true,
        allowedIps: true,
        createdAt: true,
      },
    });

    // Return the full key ONLY on creation (never stored in plain text)
    res.status(201).json({
      success: true,
      data: { ...apiKey, key: rawKey },
      message: 'Clé API créée. Copiez-la maintenant, elle ne sera plus affichée.',
    });
  })
);

// PATCH /api/api-keys/:id — update an API key
apiKeyRouter.patch('/:id', authenticate, requireDAF, validate(v.updateApiKeySchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.apiKey.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Clé API introuvable' });
    }

    const updated = await prisma.apiKey.update({
      where: { id: req.params.id },
      data: req.body,
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        allowedIps: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: updated });
  })
);

// DELETE /api/api-keys/:id — delete an API key
apiKeyRouter.delete('/:id', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const existing = await prisma.apiKey.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Clé API introuvable' });
    }

    await prisma.apiKey.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: 'Clé API supprimée' });
  })
);

// =============================================================================
// TENANT SETTINGS (FedaPay, etc.)
// =============================================================================
export const tenantSettingsRouter = Router();

// GET /api/tenant/settings — get tenant settings (secrets masked)
tenantSettingsRouter.get('/', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { settings: true },
    });

    const settings = (tenant?.settings as Record<string, any>) || {};

    // Return settings with secrets masked
    const safeSettings: Record<string, any> = {
      currency: settings.currency || 'XOF',
      language: settings.language || 'fr',
      fedapay: {
        enabled: !!settings.fedapaySecretKey,
        secretKeyMasked: settings.fedapaySecretKey ? maskSecret(decrypt(settings.fedapaySecretKey)) : null,
        isSandbox: settings.fedapaySandbox !== false,
        callbackUrl: settings.fedapayCallbackUrl || '',
      },
      paymentWebhookUrl: settings.paymentWebhookUrl || '',
    };

    res.json({ success: true, data: safeSettings });
  })
);

// PATCH /api/tenant/settings/fedapay — configure FedaPay for this tenant
tenantSettingsRouter.patch('/fedapay', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    const { secretKey, isSandbox, callbackUrl, paymentWebhookUrl } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant?.settings as Record<string, any>) || {};

    // Build updated settings
    const updatedSettings: Record<string, any> = { ...currentSettings };

    if (secretKey !== undefined) {
      if (secretKey === '' || secretKey === null) {
        // Remove FedaPay config
        delete updatedSettings.fedapaySecretKey;
      } else {
        // Validate key format
        if (!secretKey.startsWith('sk_sandbox_') && !secretKey.startsWith('sk_live_')) {
          return res.status(400).json({
            success: false,
            error: 'La clé secrète FedaPay doit commencer par sk_sandbox_ ou sk_live_',
          });
        }
        // Encrypt and store
        updatedSettings.fedapaySecretKey = encrypt(secretKey);
      }
    }

    if (isSandbox !== undefined) {
      updatedSettings.fedapaySandbox = isSandbox;
    }

    if (callbackUrl !== undefined) {
      updatedSettings.fedapayCallbackUrl = callbackUrl;
    }

    if (paymentWebhookUrl !== undefined) {
      updatedSettings.paymentWebhookUrl = paymentWebhookUrl;
    }

    await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { settings: updatedSettings },
    });

    // Return masked result
    res.json({
      success: true,
      data: {
        enabled: !!updatedSettings.fedapaySecretKey,
        secretKeyMasked: updatedSettings.fedapaySecretKey ? maskSecret(decrypt(updatedSettings.fedapaySecretKey)) : null,
        isSandbox: updatedSettings.fedapaySandbox !== false,
        callbackUrl: updatedSettings.fedapayCallbackUrl || '',
      },
    });
  })
);

// DELETE /api/tenant/settings/fedapay — disconnect FedaPay
tenantSettingsRouter.delete('/fedapay', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant?.settings as Record<string, any>) || {};
    delete currentSettings.fedapaySecretKey;
    delete currentSettings.fedapaySandbox;
    delete currentSettings.fedapayCallbackUrl;

    await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { settings: currentSettings },
    });

    res.json({ success: true, message: 'FedaPay déconnecté' });
  })
);

// POST /api/tenant/settings/fedapay/test — test FedaPay connection
tenantSettingsRouter.post('/fedapay/test', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { settings: true },
    });

    const settings = (tenant?.settings as Record<string, any>) || {};
    if (!settings.fedapaySecretKey) {
      return res.status(400).json({ success: false, error: 'Aucune clé FedaPay configurée' });
    }

    const secretKey = decrypt(settings.fedapaySecretKey);
    const isSandbox = settings.fedapaySandbox !== false;
    const apiBase = isSandbox ? 'https://sandbox-api.fedapay.com' : 'https://api.fedapay.com';

    try {
      // Test with a small transaction creation then cancel — FedaPay has no /accounts/me endpoint
      const response = await fetch(`${apiBase}/v1/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Test de connexion Teranga PMS',
          amount: 100,
          currency: { iso: 'XOF' },
        }),
      });

      const data = await response.json() as any;

      if (response.ok || response.status === 201) {
        // Clean up: delete the test transaction
        const txnId = data?.v1?.transaction?.id || data?.transaction?.id;
        if (txnId) {
          fetch(`${apiBase}/v1/transactions/${txnId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${secretKey}` },
          }).catch(() => {});
        }

        res.json({
          success: true,
          data: {
            connected: true,
            mode: isSandbox ? 'sandbox' : 'live',
            accountName: 'Compte FedaPay',
          },
        });
      } else {
        res.json({
          success: false,
          error: data?.message || data?.error?.message || `Erreur FedaPay (${response.status})`,
        });
      }
    } catch (err: any) {
      res.json({
        success: false,
        error: `Impossible de joindre FedaPay: ${err.message}`,
      });
    }
  })
);
