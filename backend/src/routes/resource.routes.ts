import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authenticateApiKey } from '../middlewares/auth.middleware';
import {
  requireSuperAdmin,
  requireAuthenticated,
  requireOwner,
  requireDAF,
  requireDAFOrManager,
  requireDAFOrManagerOrServer,
  requireOrderCreator,
  requirePaymentRole,
  requireKitchenAccess,
  requireCleaningAccess,
  requireAnyEstablishmentRole,
  requireSelfOrRole,
  requireEstablishmentRole,
  getEstablishmentRole,
  canEditOrder,
} from '../middlewares/rbac.middleware';
import { validate, validateQuery } from '../middlewares/validate.middleware';
import { checkPlanLimit } from '../middlewares/plan-limits.middleware';
import { parsePagination, validateOperationDate } from '../utils/helpers';
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
import { registrationService } from '../services/registration.service';
import { clientService } from '../services/client.service';
import { discountService } from '../services/discount.service';
import { expenseService } from '../services/expense.service';
// QR code and prisma for invoice QR endpoint
const QRCode = require('qrcode');
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { createTenantClient } from '../utils/prisma';
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

// Lightweight owners list — accessible to all authenticated users (for Bon Propriétaire dropdown)
userRouter.get('/owners', authenticate,
  asyncHandler(async (req, res) => {
    const db = createTenantClient(req.user!.tenantId);
    const members = await db.establishmentMember.findMany({
      where: { role: 'OWNER', isActive: true },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      distinct: ['userId'],
    });
    const owners = members.map((m: any) => ({
      id: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      name: `${m.user.firstName} ${m.user.lastName}`,
    }));
    res.json({ success: true, data: owners });
  })
);

userRouter.get('/:id', authenticate, requireSelfOrRole('DAF', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = await userService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// DAF & MANAGER can create users (MANAGER creates under DAF approval)
userRouter.post('/', authenticate, requireDAFOrManager, checkPlanLimit('users'), validate(v.createUserSchema),
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

// Unarchive a user (SUPERADMIN only)
userRouter.post('/:id/unarchive', authenticate, requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const data = await userService.unarchive(req.params.id);
    res.json({ success: true, data, message: 'Utilisateur désarchivé' });
  })
);

// Hard delete a user (SUPERADMIN only)
userRouter.delete('/:id/permanent', authenticate, requireSuperAdmin,
  asyncHandler(async (req, res) => {
    await userService.hardDelete(req.params.id);
    res.json({ success: true, message: 'Utilisateur supprimé définitivement' });
  })
);

// =============================================================================
// ESTABLISHMENTS
// =============================================================================
export const establishmentRouter = Router();

establishmentRouter.get('/', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const isSuperAdmin = req.user!.role === 'SUPERADMIN';
    const result = await establishmentService.list(req.user!.tenantId, params, req.user!.establishmentIds, isSuperAdmin);
    // Inject the current user's establishment role into each establishment
    const memberships = req.user?.memberships || [];
    const data = (result.data || []).map((est: any) => {
      const membership = memberships.find((m: any) => m.establishmentId === est.id);
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

establishmentRouter.post('/', authenticate, requireOwner, checkPlanLimit('establishments'), validate(v.createEstablishmentSchema),
  asyncHandler(async (req, res) => {
    const data = await establishmentService.create(req.user!.tenantId, req.body, req.user!.id);
    res.status(201).json({ success: true, data });
  })
);

establishmentRouter.patch('/:id', authenticate, requireOwner, validate(v.updateEstablishmentSchema),
  asyncHandler(async (req, res) => {
    const data = await establishmentService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

establishmentRouter.delete('/:id', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    await establishmentService.delete(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Établissement supprimé' });
  })
);

// Servers/maitres: used by POS to attribute orders to the floor staff
establishmentRouter.get('/:id/servers', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const members = await prisma.establishmentMember.findMany({
      where: {
        establishmentId: req.params.id,
        role: { in: ['SERVER', 'MAITRE_HOTEL'] },
        user: { tenantId: req.user!.tenantId, status: 'ACTIVE' },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const data = members
      .map((m) => ({ id: m.user.id, firstName: m.user.firstName, lastName: m.user.lastName, role: m.role }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName));
    res.json({ success: true, data });
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

roomRouter.post('/', authenticate, requireDAFOrManager, checkPlanLimit('rooms'), validate(v.createRoomSchema),
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

// OWNER / DAF / MANAGER can edit a reservation directly. The service refuses
// when the linked invoice is already PAID/CANCELLED so accounting stays sane.
reservationRouter.patch('/:id', authenticate, requireEstablishmentRole('OWNER', 'DAF', 'MANAGER'),
  validate(v.updateReservationSchema),
  asyncHandler(async (req, res) => {
    const data = await reservationService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

// Admin: backfill invoices/payments for older channel reservations that were
// created before the channel-sync fix landed. Idempotent and safe to re-run.
reservationRouter.post('/admin/backfill-channel-invoices', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    const result = await reservationService.backfillChannelInvoices(req.user!.tenantId);
    res.json({ success: true, data: result });
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
    const { establishmentId, status, createdById, forUserId, from, to } = req.query as any;
    const data = await orderService.list(req.user!.tenantId, params, {
      establishmentId, status, createdById, forUserId, from, to,
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

// Duplicate detection — DAF/MANAGER/OWNER only
orderRouter.get('/duplicates', authenticate, requireEstablishmentRole('DAF', 'MANAGER', 'OWNER'),
  asyncHandler(async (req, res) => {
    const { establishmentId } = req.query as any;
    const data = await orderService.findDuplicates(req.user!.tenantId, establishmentId);
    res.json({ success: true, data });
  })
);

// Cancel duplicates — DAF/MANAGER/OWNER only
orderRouter.post('/duplicates/cancel', authenticate, requireEstablishmentRole('DAF', 'MANAGER', 'OWNER'),
  asyncHandler(async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, error: 'orderIds requis (tableau d\'IDs)' });
    }
    const data = await orderService.cancelDuplicates(req.user!.tenantId, orderIds, req.user!.id);
    res.json({ success: true, data });
  })
);

// Servers create orders — LEISURE/LOCATION orders restricted to POS/OWNER/SUPERADMIN
orderRouter.post('/', authenticate, requireOrderCreator, validate(v.createOrderSchema),
  asyncHandler(async (req, res) => {
    if (req.body.orderType === 'LEISURE' || req.body.orderType === 'LOCATION') {
      const userRole = req.user!.role;
      const estRole = req.user?.memberships?.find(
        (m) => m.establishmentId === req.body.establishmentId
      )?.role;
      const canCreateSpecial = userRole === 'SUPERADMIN' || estRole === 'OWNER' || estRole === 'POS';
      if (!canCreateSpecial) {
        return res.status(403).json({ success: false, error: 'Seuls le POS, les propriétaires et le superadmin peuvent créer des commandes de loisirs/location' });
      }
    }
    // Validate optional operationDate (used as Invoice.issueDate for backdated POS entries)
    let operationDate: Date | null = null;
    if (req.body.operationDate) {
      operationDate = validateOperationDate(req.body.operationDate, {
        userRole: req.user!.role,
        establishmentRole: req.user?.memberships?.find(
          (m) => m.establishmentId === req.body.establishmentId
        )?.role ?? null,
        fieldLabel: "la date de l'opération",
      });
    }
    const data = await orderService.create(
      req.user!.tenantId,
      req.user!.id,
      { ...req.body, ...(operationDate ? { operationDate } : {}) }
    );
    res.status(201).json({ success: true, data });
  })
);

// Append items to an open order (no more merge needed — one order grows)
orderRouter.post('/:id/items', authenticate, requireOrderCreator,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items requis (tableau non vide)' });
    }
    for (const it of items) {
      if (!it?.articleId || typeof it?.quantity !== 'number' || it.quantity < 1) {
        return res.status(400).json({ success: false, error: 'Chaque item doit avoir articleId et quantity ≥ 1' });
      }
    }
    const ownership = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId },
      select: { createdById: true, serverId: true, establishmentId: true },
    });
    if (!ownership) return res.status(404).json({ success: false, error: 'Commande introuvable' });
    if (!canEditOrder(req, ownership)) {
      return res.status(403).json({ success: false, error: 'Vous ne pouvez pas modifier une commande ouverte par un autre serveur' });
    }
    const data = await orderService.addItems(tenantId, req.params.id, req.user!.id, {
      items,
      idempotencyKey: req.body?.idempotencyKey,
    });
    res.status(201).json({ success: true, data });
  })
);

// Toggle the "bon propriétaire" flag on an existing order.
// Only OWNER/DAF/MANAGER can change voucher status — servers and POS cannot
// retroactively turn a regular order into a voucher (or vice versa).
orderRouter.patch('/:id/voucher', authenticate, requireEstablishmentRole('OWNER', 'DAF', 'MANAGER'),
  validate(v.updateOrderVoucherSchema),
  asyncHandler(async (req, res) => {
    const data = await orderService.setVoucherFlag(req.user!.tenantId, req.params.id, req.user!.id, req.body);
    res.json({ success: true, data });
  })
);

// Cooks mark IN_PROGRESS/READY, servers mark SERVED, DAF/MANAGER can cancel
orderRouter.patch('/:id/status', authenticate, requireEstablishmentRole('DAF', 'MANAGER', 'SERVER', 'COOK'),
  validate(v.updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    // Kitchen-facing transitions (IN_PROGRESS/READY) are role-scoped only.
    // Server-facing transitions (SERVED/CANCELLED) also enforce the order
    // ownership rule so a second POS/server can't close someone else's ticket.
    const target = req.body.status;
    if (target === 'SERVED' || target === 'CANCELLED') {
      const ownership = await prisma.order.findFirst({
        where: { id: req.params.id, tenantId },
        select: { createdById: true, serverId: true, establishmentId: true },
      });
      if (!ownership) return res.status(404).json({ success: false, error: 'Commande introuvable' });
      if (!canEditOrder(req, ownership)) {
        return res.status(403).json({ success: false, error: 'Vous ne pouvez pas modifier une commande ouverte par un autre serveur' });
      }
    }
    const data = await orderService.updateStatus(tenantId, req.params.id, target, req.user!.id);
    res.json({ success: true, data });
  })
);

// Encaisser une commande : enregistre le paiement sur sa facture + marque SERVED + met à jour paymentMethod
orderRouter.post('/:id/cashin', authenticate, requirePaymentRole,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const methodRaw = (req.body.method as string | undefined) || 'CASH';
    const validMethods = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'MOOV_MONEY', 'MIXX_BY_YAS', 'FEDAPAY', 'OTHER'];
    if (!validMethods.includes(methodRaw)) {
      return res.status(400).json({ success: false, error: 'Méthode de paiement invalide' });
    }
    // Async methods require client-side confirmation (FedaPay webhook, mobile
    // money QR scan). They must go through GET /invoices/:id/qrcode + payment
    // polling; recording a synchronous payment here would mark the invoice as
    // paid before any real transfer takes place.
    const asyncMethods = ['FEDAPAY', 'MOBILE_MONEY', 'MOOV_MONEY', 'MIXX_BY_YAS'];
    if (asyncMethods.includes(methodRaw)) {
      return res.status(400).json({
        success: false,
        error: 'Cette méthode nécessite une confirmation client — utiliser le QR code de paiement',
        code: 'ASYNC_PAYMENT_REQUIRED',
      });
    }
    const method = methodRaw as any;

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId },
      select: { id: true, invoiceId: true, status: true, createdById: true, serverId: true, establishmentId: true, operationDate: true },
    });
    if (!order) return res.status(404).json({ success: false, error: 'Commande introuvable' });
    if (!canEditOrder(req, order)) {
      return res.status(403).json({ success: false, error: 'Vous ne pouvez pas encaisser une commande ouverte par un autre serveur' });
    }
    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Commande annulée' });
    }
    if (!order.invoiceId) {
      return res.status(400).json({ success: false, error: 'Aucune facture liée à cette commande' });
    }

    // Optional backdated payment date. Falls back to the order's operationDate so
    // that encaissing a backdated order automatically books the payment on the right day.
    let paidAt: Date | null = null;
    try {
      if (req.body.paidAt) {
        paidAt = validateOperationDate(req.body.paidAt, {
          userRole: req.user!.role,
          establishmentRole: getEstablishmentRole(req, order.establishmentId),
          fieldLabel: 'la date de paiement',
        });
      } else if (order.operationDate) {
        paidAt = order.operationDate as Date;
      }
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }

    const invoice = await invoiceService.getById(tenantId, order.invoiceId);
    if (!invoice) return res.status(404).json({ success: false, error: 'Facture introuvable' });
    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Facture annulée' });
    }

    // Solde restant
    const existingPayments = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true },
    });
    const totalPaid = existingPayments._sum.amount?.toNumber() ?? 0;
    const remaining = invoice.totalAmount.toNumber() - totalPaid;

    if (remaining <= 0.01) {
      // Déjà payée — juste mettre à jour la méthode + marquer servie (items inclus)
      await prisma.$transaction([
        prisma.orderItem.updateMany({
          where: { orderId: order.id, status: { not: 'CANCELLED' } },
          data: { status: 'SERVED' },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: {
            paymentMethod: method,
            ...(order.status !== 'SERVED' && { status: 'SERVED', servedAt: new Date() }),
          },
        }),
      ]);
      return res.json({ success: true, data: { paid: true, amount: 0, alreadyPaid: true } });
    }

    const { payment } = await paymentService.create(tenantId, {
      invoiceId: invoice.id,
      amount: remaining,
      method,
      ...(paidAt ? { paidAt } : {}),
    });

    await prisma.$transaction([
      prisma.orderItem.updateMany({
        where: { orderId: order.id, status: { not: 'CANCELLED' } },
        data: { status: 'SERVED' },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: method,
          ...(order.status !== 'SERVED' && { status: 'SERVED', servedAt: new Date() }),
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: remaining,
        method,
      },
    });
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

// Find open invoices for a specific table (for merge feature)
invoiceRouter.get('/by-table/:tableNumber', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const tableNumber = req.params.tableNumber.trim();
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ['ISSUED', 'DRAFT'] },
        orders: { some: { tableNumber: { equals: tableNumber, mode: 'insensitive' } } },
      },
      include: {
        items: { include: { article: { select: { id: true, name: true } } } },
        orders: { select: { id: true, orderNumber: true, tableNumber: true, totalAmount: true, createdAt: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Exclude invoices that already have payments
    const mergeable = invoices
      .filter((inv: any) => inv._count.payments === 0)
      .map((inv: any) => ({
        ...inv,
        subtotal: Number(inv.subtotal),
        taxRate: Number(inv.taxRate),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        orders: inv.orders.map((o: any) => ({ ...o, totalAmount: Number(o.totalAmount) })),
      }));
    res.json({ success: true, data: mergeable });
  })
);

// Merge multiple invoices into one — MUST be before /:id routes
invoiceRouter.post('/merge', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const { invoiceIds, tableNumber } = req.body;
    if (!Array.isArray(invoiceIds) || invoiceIds.length < 2) {
      res.status(400).json({ success: false, error: 'Au moins 2 factures requises' });
      return;
    }
    const data = await invoiceService.merge(req.user!.tenantId, req.user!.id, invoiceIds, tableNumber);
    res.json({ success: true, data });
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
    let issueDate: Date | null = null;
    try {
      issueDate = validateOperationDate(req.body.issueDate, {
        userRole: req.user!.role,
        establishmentRole: req.body.establishmentId ? getEstablishmentRole(req, req.body.establishmentId) : null,
        fieldLabel: 'la date d\'émission',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
    const data = await invoiceService.create(req.user!.tenantId, req.user!.id, {
      ...req.body,
      ...(issueDate ? { issueDate } : {}),
    });
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

// Payment status check (polling endpoint for FedaPay confirmation)
invoiceRouter.get('/:id/payment-status', authenticate,
  asyncHandler(async (req, res) => {
    const invoice = await invoiceService.getById(req.user!.tenantId, req.params.id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Facture introuvable' });
      return;
    }
    const paid = invoice.status === 'PAID';
    res.json({
      success: true,
      data: {
        invoiceId: invoice.id,
        status: invoice.status,
        paid,
        paidAt: (invoice as any).paidAt || null,
        totalAmount: Number(invoice.totalAmount),
      },
    });
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

    // Priority: explicit query param (user's current choice on the page) > order > invoice > existing payment > default
    const paymentMethod = (req.query.paymentMethod as string) || order?.paymentMethod || (invoice as any).paymentMethod || existingPayment?.method || 'MOBILE_MONEY';

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

      if (!fedapayKey) {
        appLogger.warn('FedaPay QR requested but no FedaPay secret key is configured (tenant settings or global env)', {
          tenantId: req.user!.tenantId,
          invoiceId: invoice.id,
        });
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
            // Extract transaction ID from FedaPay response
            // Actual format: {"v1/transaction": {"klass": "v1/transaction", "id": 420517, ...}}
            let transactionId: string | number | undefined;
            if (txnData?.['v1/transaction']?.id) {
              transactionId = txnData['v1/transaction'].id;
            } else if (txnData?.v1?.transaction?.id) {
              transactionId = txnData.v1.transaction.id;
            } else if (txnData?.transaction?.id) {
              transactionId = txnData.transaction.id;
            } else if (txnData?.id && txnData?.klass?.includes('transaction')) {
              transactionId = txnData.id;
            }
            // Fallback: search for any key containing 'transaction' with an id
            if (!transactionId) {
              for (const [k, v] of Object.entries(txnData || {})) {
                if (k.includes('transaction') && typeof v === 'object' && (v as any)?.id) {
                  transactionId = (v as any).id;
                  break;
                }
              }
            }

            appLogger.info('FedaPay extracted transactionId', { transactionId });

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
                // FedaPay returns {"token": "...", "url": "https://sandbox-process.fedapay.com/..."}
                // Use the URL directly from the response — it's the correct checkout page
                let checkoutUrl = tokenData?.url;
                let token = tokenData?.token || tokenData?.data?.token;
                // Also check nested format
                if (!checkoutUrl || !token) {
                  for (const [k, v] of Object.entries(tokenData || {})) {
                    if (typeof v === 'object') {
                      if (!checkoutUrl && (v as any)?.url) checkoutUrl = (v as any).url;
                      if (!token && (v as any)?.token) token = (v as any).token;
                    }
                  }
                }
                appLogger.info('FedaPay extracted checkout', { hasUrl: !!checkoutUrl, hasToken: !!token });
                if (checkoutUrl) {
                  fedapayCheckoutUrl = checkoutUrl;
                } else if (token) {
                  // Fallback: build URL from token
                  fedapayCheckoutUrl = isSandbox
                    ? `https://sandbox-process.fedapay.com/${token}`
                    : `https://process.fedapay.com/${token}`;
                }
              }
            } else {
              appLogger.error('FedaPay: no transaction ID found in response', { body: JSON.stringify(txnData).substring(0, 500) });
            }
          } else {
            appLogger.error('FedaPay txn creation failed', { status: txnResponse.status, body: JSON.stringify(txnData).substring(0, 500) });
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
        paymentLabel: ({
          CASH: 'Espèces',
          CARD: 'Carte',
          BANK_TRANSFER: 'Virement',
          MOBILE_MONEY: 'Mobile Money',
          MOOV_MONEY: 'Flooz',
          MIXX_BY_YAS: 'Yas',
          FEDAPAY: 'FedaPay',
          OTHER: 'Autre',
        } as Record<string, string>)[paymentMethod] || paymentMethod,
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
    // Validate optional backdated paidAt (offline replay may carry a client clock)
    let paidAt: Date | undefined;
    if (req.body.paidAt) {
      try {
        const d = validateOperationDate(req.body.paidAt, {
          userRole: req.user!.role,
          establishmentRole: req.user?.memberships?.[0]?.role ?? null,
          fieldLabel: 'la date du paiement',
        });
        paidAt = d ?? undefined;
      } catch (e: any) {
        return res.status(400).json({ success: false, error: e.message });
      }
    }
    const { payment, alreadyProcessed } = await paymentService.create(req.user!.tenantId, {
      ...req.body,
      ...(paidAt ? { paidAt } : {}),
    });
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

articleRouter.get('/duplicates', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await articleService.findDuplicates(req.user!.tenantId);
    res.json({ success: true, data });
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

// DAF and MANAGER can create articles; DAF-created articles require OWNER approval
articleRouter.post('/', authenticate, requireDAFOrManager, validate(v.createArticleSchema),
  asyncHandler(async (req, res) => {
    const { establishmentId: estId, ...articleData } = req.body;
    const resolvedEstId = estId || req.query.establishmentId as string || req.user?.establishmentIds?.[0] || '';

    const existingArticle = await articleService.findByName(req.user!.tenantId, articleData.name);
    if (existingArticle) {
      return res.status(409).json({ success: false, error: `Un article avec le nom "${articleData.name}" existe déjà` });
    }

    const userRole = getEstablishmentRole(req, resolvedEstId);
    const needsApproval = userRole === 'DAF';

    const data = await articleService.create(req.user!.tenantId, {
      ...articleData,
      establishmentId: resolvedEstId || undefined,
      isApproved: !needsApproval,
      isActive: !needsApproval,
      createdById: req.user!.id,
    });

    if (needsApproval) {
      await approvalService.create(req.user!.tenantId, {
        establishmentId: resolvedEstId,
        type: 'ARTICLE_CREATION',
        requestedById: req.user!.id,
        targetId: data.id,
        payload: { name: data.name, unitPrice: data.unitPrice, categoryId: data.categoryId },
      });
      return res.status(201).json({ success: true, data, requiresApproval: true });
    }

    res.status(201).json({ success: true, data });
  })
);

articleRouter.patch('/:id', authenticate, requireDAFOrManager, validate(v.updateArticleSchema),
  asyncHandler(async (req, res) => {
    const data = await articleService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

articleRouter.delete('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await articleService.delete(req.user!.tenantId, req.params.id);
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

    // Business date for accounting — may be backdated within 15 days, or further if supervisor
    let occurredAt: Date | null = null;
    try {
      occurredAt = validateOperationDate(req.body.occurredAt, {
        userRole: req.user!.role,
        establishmentRole: estRole,
        fieldLabel: 'la date du mouvement',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }

    const payload = { ...req.body, ...(occurredAt ? { occurredAt } : {}) };

    // MANAGER stock movements require DAF approval
    if (estRole === 'MANAGER') {
      const movement = await stockService.createMovement(req.user!.tenantId, req.user!.id, {
        ...payload,
        requiresApproval: true,
      });

      const approval = await approvalService.create(req.user!.tenantId, {
        establishmentId: estId,
        type: 'STOCK_MOVEMENT',
        requestedById: req.user!.id,
        payload,
        targetId: (movement as any).id || (movement as any).data?.id,
      });

      return res.status(202).json({
        success: true,
        message: 'Mouvement de stock soumis à validation du DAF',
        data: approval,
      });
    }

    const data = await stockService.createMovement(req.user!.tenantId, req.user!.id, payload);
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
// EXPENSES (Décaissements)
// =============================================================================
export const expenseRouter = Router();

// List — MANAGER+ can read expenses in their establishment
expenseRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { establishmentId, from, to, category, includeDeleted } = req.query as any;
    const data = await expenseService.list(req.user!.tenantId, params, {
      establishmentId,
      from,
      to,
      category,
      includeDeleted: includeDeleted === 'true',
    });
    res.json({ success: true, ...data });
  })
);

expenseRouter.get('/summary', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const { establishmentId, from, to } = req.query as any;
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'from et to sont requis' });
    }
    const data = await expenseService.summary(req.user!.tenantId, {
      establishmentId,
      from: new Date(from),
      to: new Date(to),
    });
    res.json({ success: true, data });
  })
);

expenseRouter.get('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await expenseService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// Create — MANAGER/DAF/OWNER; date can be backdated (same rules as orders)
expenseRouter.post('/', authenticate, requireDAFOrManager, validate(v.createExpenseSchema),
  asyncHandler(async (req, res) => {
    const estId = req.body.establishmentId;
    const estRole = getEstablishmentRole(req, estId);

    let operationDate: Date | null = null;
    try {
      operationDate = validateOperationDate(req.body.operationDate, {
        userRole: req.user!.role,
        establishmentRole: estRole,
        fieldLabel: 'la date du décaissement',
      });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }

    const data = await expenseService.create(req.user!.tenantId, req.user!.id, {
      ...req.body,
      ...(operationDate ? { operationDate } : {}),
    });
    res.status(201).json({ success: true, data });
  })
);

// Update — DAF/OWNER only (financial integrity)
expenseRouter.put('/:id', authenticate, requireDAF, validate(v.updateExpenseSchema),
  asyncHandler(async (req, res) => {
    let operationDate: Date | undefined;
    if (req.body.operationDate) {
      try {
        const d = validateOperationDate(req.body.operationDate, {
          userRole: req.user!.role,
          establishmentRole: 'DAF',
          fieldLabel: 'la date du décaissement',
        });
        operationDate = d ?? undefined;
      } catch (e: any) {
        return res.status(400).json({ success: false, error: e.message });
      }
    }
    const data = await expenseService.update(req.user!.tenantId, req.params.id, {
      ...req.body,
      ...(operationDate ? { operationDate } : {}),
    });
    res.json({ success: true, data });
  })
);

// Soft-delete — DAF/OWNER only
expenseRouter.delete('/:id', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    await expenseService.softDelete(req.user!.tenantId, req.params.id, req.user!.id);
    res.json({ success: true });
  })
);

// PDF voucher (bon de décaissement)
expenseRouter.get('/:id/voucher', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const pdfBuffer = await expenseService.generateVoucherPDF(req.user!.tenantId, req.params.id);
    const safeId = req.params.id.slice(0, 8).toUpperCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bon-decaissement-${safeId}.pdf"`);
    res.send(pdfBuffer);
  })
);

// =============================================================================
// EXPENSE CUSTOM CATEGORIES
// =============================================================================
export const expenseCategoryRouter = Router();

// List — MANAGER+ can read
expenseCategoryRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await expenseService.listCategories(req.user!.tenantId);
    res.json({ success: true, data });
  })
);

// Create — MANAGER/DAF/OWNER
expenseCategoryRouter.post('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Le nom de la catégorie est requis' });
    }
    const data = await expenseService.createCategory(req.user!.tenantId, name);
    res.status(201).json({ success: true, data });
  })
);

// Delete — DAF/OWNER only (blocks if still in use)
expenseCategoryRouter.delete('/:id', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    await expenseService.deleteCategory(req.user!.tenantId, req.params.id);
    res.json({ success: true });
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
    // Determine reviewer's effective role (SUPERADMIN counts as OWNER)
    const reviewerRole = req.user!.role === 'SUPERADMIN'
      ? 'SUPERADMIN'
      : req.user?.memberships?.map(m => m.role).includes('OWNER') ? 'OWNER' : 'DAF';
    const data = await approvalService.approve(req.user!.tenantId, req.params.id, req.user!.id, reviewerRole);
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
// RESTAURANT TABLES
// =============================================================================
export const restaurantTableRouter = Router();

restaurantTableRouter.get('/', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const db = createTenantClient(req.user!.tenantId);
    const { establishmentId } = req.query as any;
    const where: any = { isActive: true };
    if (establishmentId) where.establishmentId = establishmentId;
    const data = await db.restaurantTable.findMany({
      where,
      orderBy: { number: 'asc' },
    });
    res.json({ success: true, data });
  })
);

restaurantTableRouter.post('/', authenticate, requireDAFOrManager, validate(v.createRestaurantTableSchema),
  asyncHandler(async (req, res) => {
    const db = createTenantClient(req.user!.tenantId);
    const { establishmentId, number, label, capacity } = req.body;
    const existing = await db.restaurantTable.findFirst({
      where: { tenantId: req.user!.tenantId, establishmentId, number },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: `La table "${number}" existe déjà` });
    }
    const data = await db.restaurantTable.create({
      data: {
        tenantId: req.user!.tenantId,
        establishmentId,
        number,
        label: label || null,
        capacity: capacity || 4,
      },
    });
    res.status(201).json({ success: true, data });
  })
);

restaurantTableRouter.patch('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const db = createTenantClient(req.user!.tenantId);
    const { number, label, capacity, isActive } = req.body;
    const data = await db.restaurantTable.update({
      where: { id: req.params.id },
      data: {
        ...(number !== undefined && { number }),
        ...(label !== undefined && { label }),
        ...(capacity !== undefined && { capacity }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ success: true, data });
  })
);

restaurantTableRouter.delete('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const db = createTenantClient(req.user!.tenantId);
    await db.restaurantTable.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Table supprimée' });
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
      paidAmount: Number(amountPaid || 0),
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
      appLogger.info('FedaPay test response', { status: response.status, body: JSON.stringify(data).substring(0, 500) });

      if (response.ok || response.status === 201) {
        // Clean up: delete the test transaction
        const txnId = data?.v1?.transaction?.id || data?.transaction?.id || data?.id;
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

// =============================================================================
// SUBSCRIPTION MANAGEMENT (SUPERADMIN only)
// =============================================================================
export const subscriptionRouter = Router();

// GET /api/subscriptions — View current tenant's subscription + plan
// Accessible to SUPERADMIN, OWNER, DAF
subscriptionRouter.get('/', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: req.user!.tenantId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { name: true, slug: true, plan: true, isActive: true },
    });

    // Compute current usage for plan limits
    const [roomCount, userCount, establishmentCount] = await Promise.all([
      prisma.room.count({ where: { tenantId: req.user!.tenantId } }),
      prisma.user.count({ where: { tenantId: req.user!.tenantId, status: { not: 'ARCHIVED' } } }),
      prisma.establishment.count({ where: { tenantId: req.user!.tenantId } }),
    ]);

    res.json({
      success: true,
      data: {
        subscription,
        tenant,
        usage: { rooms: roomCount, users: userCount, establishments: establishmentCount },
      },
    });
  })
);

// GET /api/subscriptions/plans — List all available plans
// Accessible to SUPERADMIN, OWNER, DAF
subscriptionRouter.get('/plans', authenticate, requireDAF,
  asyncHandler(async (_req, res) => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: plans });
  })
);

// GET /api/subscriptions/all — List all tenants with their subscriptions (SUPERADMIN only)
subscriptionRouter.get('/all', authenticate, requireSuperAdmin,
  asyncHandler(async (_req, res) => {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        createdAt: true,
        subscription: {
          include: {
            plan: true,
            payments: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
        _count: { select: { rooms: true, users: true, establishments: true } },
      },
    });
    res.json({ success: true, data: tenants });
  })
);

// POST /api/subscriptions/renew — Generate a renewal payment link (FedaPay)
// Accessible to SUPERADMIN, OWNER, DAF
subscriptionRouter.post('/renew', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    const checkoutUrl = await registrationService.generateRenewalLink(req.user!.tenantId);
    if (!checkoutUrl) {
      return res.status(400).json({ success: false, error: 'Impossible de générer le lien de paiement' });
    }
    res.json({ success: true, data: { checkoutUrl } });
  })
);

// POST /api/subscriptions/activate — Manually activate/extend a subscription (SUPERADMIN)
// Used when a client pays cash/main à main. tenantId in body targets a specific tenant.
subscriptionRouter.post('/activate', authenticate, requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { planSlug, billingInterval, months, tenantId: targetTenantId } = req.body;
    const tenantId = targetTenantId || req.user!.tenantId;

    const durationMonths = months || (billingInterval === 'YEARLY' ? 12 : 1);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

    // Resolve plan
    let planId: string | undefined;
    if (planSlug) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } });
      if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' });
      planId = plan.id;
    }

    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });

    if (subscription) {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { tenantId },
          data: {
            status: 'ACTIVE',
            ...(planId && { planId }),
            ...(billingInterval && { billingInterval }),
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            lastPaymentAt: now,
            lastPaymentRef: `manual_${Date.now()}`,
            gracePeriodEndsAt: null,
            trialEndsAt: null,
          },
        });

        await tx.tenant.update({
          where: { id: tenantId },
          data: { isActive: true, ...(planSlug && { plan: planSlug }) },
        });

        await tx.user.updateMany({
          where: { tenantId, status: 'LOCKED' },
          data: { status: 'ACTIVE' },
        });

        await tx.subscriptionPayment.create({
          data: {
            subscriptionId: subscription.id,
            amount: 0,
            currency: 'XOF',
            status: 'PAID',
            periodStart: now,
            periodEnd,
            paidAt: now,
          },
        });
      });
    } else {
      const plan = planId
        ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
        : await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } });

      if (!plan) return res.status(404).json({ success: false, error: 'Aucun plan disponible' });

      await prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.create({
          data: {
            tenantId,
            planId: plan.id,
            status: 'ACTIVE',
            billingInterval: billingInterval || 'MONTHLY',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            lastPaymentAt: now,
            lastPaymentRef: `manual_${Date.now()}`,
          },
        });

        await tx.tenant.update({
          where: { id: tenantId },
          data: { isActive: true, plan: plan.slug },
        });

        await tx.subscriptionPayment.create({
          data: {
            subscriptionId: sub.id,
            amount: 0,
            currency: 'XOF',
            status: 'PAID',
            periodStart: now,
            periodEnd,
            paidAt: now,
          },
        });
      });
    }

    res.json({
      success: true,
      message: `Abonnement activé jusqu'au ${periodEnd.toLocaleDateString('fr-FR')}`,
    });
  })
);

// =============================================================================
// DASHBOARD CONFIG (User widget preferences)
// =============================================================================
export const dashboardConfigRouter = Router();

// GET — fetch current user's dashboard config
dashboardConfigRouter.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const establishmentId = (req.query.establishmentId as string) || null;

  const db = createTenantClient(req.user!.tenantId);
  const config = await db.dashboardConfig.findUnique({
    where: { userId_establishmentId: { userId, establishmentId: establishmentId || '' } },
  });

  // If no config, try the one without establishment
  if (!config && establishmentId) {
    const fallback = await db.dashboardConfig.findUnique({
      where: { userId_establishmentId: { userId, establishmentId: '' } },
    });
    return res.json({ success: true, data: fallback });
  }

  res.json({ success: true, data: config });
}));

// PUT — save/update dashboard config
dashboardConfigRouter.put('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { establishmentId, widgets } = req.body;
  const estId = establishmentId || '';

  if (!widgets || !Array.isArray(widgets)) {
    return res.status(400).json({ success: false, error: 'widgets array is required' });
  }

  const db = createTenantClient(req.user!.tenantId);
  const config = await db.dashboardConfig.upsert({
    where: { userId_establishmentId: { userId, establishmentId: estId } },
    create: { userId, establishmentId: estId || null, widgets },
    update: { widgets },
  });

  res.json({ success: true, data: config });
}));

// =============================================================================
// CLIENTS (fidelity)
// =============================================================================
export const clientRouter = Router();

clientRouter.get('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const search = req.query.search as string | undefined;
    const data = await clientService.list(req.user!.tenantId, params, search);
    res.json({ success: true, ...data });
  })
);

clientRouter.get('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await clientService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

clientRouter.get('/:id/pdf', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const pdfBuffer = await generateClientPdf(req.user!.tenantId, req.params.id);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="carte-client-${req.params.id}.pdf"`);
    res.end(pdfBuffer);
  })
);

clientRouter.post('/', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, notes } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ success: false, error: 'Prénom et nom requis' });
    const data = await clientService.findOrCreate(req.user!.tenantId, { firstName, lastName, email, phone, source: 'DIRECT' });
    if (notes) await clientService.update(req.user!.tenantId, data.id, { notes });
    res.status(201).json({ success: true, data });
  })
);

clientRouter.patch('/:id', authenticate, requireDAFOrManager,
  asyncHandler(async (req, res) => {
    const data = await clientService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

clientRouter.delete('/:id', authenticate, requireDAF,
  asyncHandler(async (req, res) => {
    await clientService.delete(req.user!.tenantId, req.params.id);
    res.json({ success: true });
  })
);

// =============================================================================
// DISCOUNT RULES
// =============================================================================
export const discountRouter = Router();

discountRouter.get('/', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const { appliesTo, isActive } = req.query as any;
    const data = await discountService.list(req.user!.tenantId, {
      appliesTo,
      isActive: isActive === undefined ? true : isActive === 'true',
    });
    res.json({ success: true, data });
  })
);

// Only OWNER creates rules
discountRouter.post('/', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    const data = await discountService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

discountRouter.patch('/:id', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    const data = await discountService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

discountRouter.delete('/:id', authenticate, requireOwner,
  asyncHandler(async (req, res) => {
    await discountService.delete(req.user!.tenantId, req.params.id);
    res.json({ success: true });
  })
);

// =============================================================================
// DAILY REPORTS
// =============================================================================
export const reportRouter = Router();

reportRouter.get('/daily', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const establishmentId = req.query.establishmentId as string | undefined;
    const tenantId = req.user!.tenantId;
    const data = await buildDailyReport(tenantId, date, establishmentId);
    res.json({ success: true, data });
  })
);

reportRouter.get('/revenue-summary', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const establishmentId = req.query.establishmentId as string | undefined;
    const tenantId = req.user!.tenantId;
    const db = createTenantClient(tenantId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

    // Week start (Monday)
    const dayOfWeek = now.getDay() || 7; // Sunday=7
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));

    // Month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Scope invoices to establishment: match order invoices OR reservation invoices for this establishment
    const estInvoiceScope: any = establishmentId
      ? {
          OR: [
            { orders: { some: { establishmentId } } },
            { reservation: { room: { establishmentId } } },
            { establishmentId },
          ],
        }
      : {};

    const voucherExclude = {
      invoice: {
        ...estInvoiceScope,
        isVoucher: false,
      },
    };

    const expenseScope: any = {
      tenantId,
      deletedAt: null,
      ...(establishmentId && { establishmentId }),
    };

    const [today, week, month, expToday, expWeek, expMonth] = await Promise.all([
      db.payment.aggregate({
        where: { tenantId, paidAt: { gte: todayStart, lte: todayEnd }, ...voucherExclude },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { tenantId, paidAt: { gte: weekStart, lte: todayEnd }, ...voucherExclude },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { tenantId, paidAt: { gte: monthStart, lte: todayEnd }, ...voucherExclude },
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { ...expenseScope, operationDate: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { ...expenseScope, operationDate: { gte: weekStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { ...expenseScope, operationDate: { gte: monthStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const bucket = (rev: any, exp: any) => {
      const income = Number(rev._sum.amount || 0);
      const decaisse = Number(exp._sum.amount || 0);
      return {
        total: income,
        count: rev._count,
        decaisse,
        decaisseCount: exp._count,
        net: income - decaisse,
      };
    };

    res.json({
      success: true,
      data: {
        today: bucket(today, expToday),
        week: bucket(week, expWeek),
        month: bucket(month, expMonth),
      },
    });
  })
);

reportRouter.get('/daily-pdf', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const establishmentId = req.query.establishmentId as string | undefined;
    const tenantId = req.user!.tenantId;
    const report = await buildDailyReport(tenantId, date, establishmentId);
    const pdf = await generateDailyReportPdf(tenantId, report, date);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=rapport-${date}.pdf`,
    });
    res.send(pdf);
  })
);

// Range report: one row per day between from and to
reportRouter.get('/range', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) {
      res.status(400).json({ success: false, error: 'Paramètres from et to requis (YYYY-MM-DD)' });
      return;
    }
    const establishmentId = req.query.establishmentId as string | undefined;
    const tenantId = req.user!.tenantId;
    const data = await buildRangeReport(tenantId, from, to, establishmentId);
    res.json({ success: true, data });
  })
);

reportRouter.get('/range-pdf', authenticate, requireDAFOrManagerOrServer,
  asyncHandler(async (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) {
      res.status(400).json({ success: false, error: 'Paramètres from et to requis' });
      return;
    }
    const establishmentId = req.query.establishmentId as string | undefined;
    const tenantId = req.user!.tenantId;
    const report = await buildRangeReport(tenantId, from, to, establishmentId);
    const pdf = await generateRangeReportPdf(tenantId, report, from, to);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=rapport-${from}-${to}.pdf`,
    });
    res.send(pdf);
  })
);

// --- Build daily report data ---
async function buildDailyReport(tenantId: string, date: string, establishmentId?: string) {
  const db = createTenantClient(tenantId);
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const estFilter = establishmentId ? { establishmentId } : {};

  // Payments made today (actual money collected) — bucket by paidAt
  // (operator-declared moment of payment, defaults to creation time).
  const payments = await db.payment.findMany({
    where: {
      tenantId,
      paidAt: { gte: dayStart, lte: dayEnd },
      // When scoped to an establishment: include payments from orders OR from reservations of that establishment
      invoice: establishmentId
        ? {
            OR: [
              { orders: { some: { establishmentId } } },
              { reservation: { room: { establishmentId } } },
            ],
          }
        : undefined,
    },
    include: {
      invoice: {
        select: {
          id: true, invoiceNumber: true, totalAmount: true, status: true,
          isVoucher: true, voucherOwnerName: true,
          reservationId: true,
          reservation: {
            select: {
              id: true, guestName: true, checkIn: true, checkOut: true, source: true,
              room: { select: { number: true, establishmentId: true } },
            },
          },
          orders: { select: { id: true, orderNumber: true, createdBy: { select: { firstName: true, lastName: true } }, server: { select: { firstName: true, lastName: true } }, paymentMethod: true, isVoucher: true, voucherOwnerName: true } },
        },
      },
    },
  });

  // Orders for this business day — bucketed by operationDate so backdated
  // entries land on the day the operator declared, not on today.
  const orders = await db.order.findMany({
    where: {
      operationDate: { gte: dayStart, lte: dayEnd },
      ...estFilter,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      server: { select: { id: true, firstName: true, lastName: true } },
      invoice: { select: { status: true } },
    },
    orderBy: { operationDate: 'asc' },
  });

  // Only encaissed orders count toward revenue — invoice must be PAID.
  // This covers all payment paths: cashin (sync), QR/FedaPay (async), simulate-payment.
  const byMethod: Record<string, { count: number; total: number }> = {};
  let totalEncaisse = 0;
  let voucherTotal = 0;
  let voucherCount = 0;
  let orderRevenue = 0;
  let orderPaymentCount = 0;

  for (const o of orders) {
    const amount = Number(o.totalAmount);
    if ((o as any).isVoucher) {
      voucherTotal += amount;
      voucherCount++;
      continue;
    }
    if ((o as any).invoice?.status !== 'PAID') continue;
    totalEncaisse += amount;
    orderRevenue += amount;
    orderPaymentCount++;
    const method = o.paymentMethod || 'NON_DEFINI';
    if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
    byMethod[method].count++;
    byMethod[method].total += amount;
  }

  // Reservations don't have an Order row, so we still source them from payments.
  let reservationRevenue = 0;
  let reservationCount = 0;
  for (const p of payments) {
    if (!p.invoice?.reservationId || p.invoice?.isVoucher) continue;
    const amount = Number(p.amount);
    reservationRevenue += amount;
    reservationCount++;
    totalEncaisse += amount;
    const method = p.method || 'CASH';
    if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
    byMethod[method].count++;
    byMethod[method].total += amount;
  }

  // Transaction details = orders (matches CSV) + reservation payments, sorted chronologically.
  const paymentDetails = [
    ...orders
      .filter((o: any) => !o.isVoucher && o.invoice?.status === 'PAID')
      .map((o: any) => ({
        invoiceNumber: '-',
        orderNumber: o.orderNumber,
        server: o.server
          ? `${o.server.firstName} ${o.server.lastName}`
          : o.createdBy
            ? `${o.createdBy.firstName} ${o.createdBy.lastName}`
            : '-',
        method: o.paymentMethod,
        amount: Number(o.totalAmount),
        time: o.createdAt,
        kind: 'ORDER' as const,
      })),
    ...payments
      .filter((p: any) => p.invoice?.reservationId && !p.invoice?.isVoucher)
      .map((p: any) => {
        const reservation = p.invoice?.reservation;
        return {
          invoiceNumber: p.invoice?.invoiceNumber || '-',
          orderNumber: reservation ? `Réservation ch. ${reservation.room?.number || '?'}` : '-',
          server: reservation ? (reservation.guestName || reservation.source || '-') : '-',
          method: p.method,
          amount: Number(p.amount),
          time: p.createdAt,
          kind: 'RESERVATION' as const,
        };
      }),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Orders by server — attribution priority: server (if POS entered on someone's behalf) else createdBy
  const byServer: Record<string, { name: string; count: number; revenue: number }> = {};
  const activeOrders = orders.filter((o: any) => !['CANCELLED', 'PENDING'].includes(o.status) && !o.isVoucher);
  for (const o of activeOrders) {
    const attributed = (o as any).server || (o as any).createdBy;
    if (attributed) {
      const key = attributed.id;
      const name = `${attributed.firstName} ${attributed.lastName}`;
      if (!byServer[key]) byServer[key] = { name, count: 0, revenue: 0 };
      byServer[key].count++;
      byServer[key].revenue += Number((o as any).totalAmount) || 0;
    }
  }

  // Orders by status
  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  }

  // Expenses (décaissements) — filtered by operationDate so backdated entries
  // land on the right day. Soft-deleted rows are excluded.
  const expenses = await db.expense.findMany({
    where: {
      tenantId,
      deletedAt: null,
      operationDate: { gte: dayStart, lte: dayEnd },
      ...estFilter,
    },
    include: {
      performedBy: { select: { firstName: true, lastName: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { operationDate: 'asc' },
  });

  const expenseByMethod: Record<string, { count: number; total: number }> = {};
  const expenseByCategory: Record<string, { count: number; total: number }> = {};
  let totalDecaisse = 0;
  const expenseDetails = expenses.map((e) => {
    const amount = Number(e.amount);
    totalDecaisse += amount;
    const m = e.paymentMethod || 'CASH';
    if (!expenseByMethod[m]) expenseByMethod[m] = { count: 0, total: 0 };
    expenseByMethod[m].count++;
    expenseByMethod[m].total += amount;
    const c = e.category || 'OTHER';
    if (!expenseByCategory[c]) expenseByCategory[c] = { count: 0, total: 0 };
    expenseByCategory[c].count++;
    expenseByCategory[c].total += amount;
    return {
      id: e.id,
      reason: e.reason,
      category: e.category,
      amount,
      method: e.paymentMethod,
      supplier: e.supplier?.name || null,
      performer: e.performedBy ? `${e.performedBy.firstName} ${e.performedBy.lastName}` : null,
      operationDate: e.operationDate,
    };
  });

  const netRevenue = totalEncaisse - totalDecaisse;

  return {
    date,
    totalEncaisse,
    totalDecaisse,
    netRevenue,
    voucherTotal,
    voucherCount,
    totalOrders: orders.length,
    reservationRevenue,
    reservationCount,
    orderRevenue,
    orderPaymentCount,
    byMethod,
    byServer: Object.values(byServer).sort((a, b) => b.revenue - a.revenue),
    byStatus,
    paymentDetails,
    expenseCount: expenses.length,
    expenseByMethod,
    expenseByCategory,
    expenseDetails,
  };
}

// --- Generate PDF for daily report ---
async function generateDailyReportPdf(tenantId: string, report: any, date: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const db = createTenantClient(tenantId);

  // Get establishment info
  const establishment = await db.establishment.findFirst({ select: { name: true, address: true, phone: true } });
  const estName = establishment?.name || 'Établissement';

  const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Espèces', CARD: 'Carte', BANK_TRANSFER: 'Virement',
    MOBILE_MONEY: 'Mobile Money', MOOV_MONEY: 'Flooz', MIXX_BY_YAS: 'Yas (MTN)',
    FEDAPAY: 'FedaPay', OTHER: 'Autre',
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[\u202F\u00A0]/g, ' ') + ' FCFA';
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Lome' });
  };
  const fmtTime = (d: any) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lome' });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // --- Header ---
    doc.fontSize(18).font('Helvetica-Bold').text(estName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(establishment?.address || '', { align: 'center' });
    if (establishment?.phone) doc.text(`Tél : ${establishment.phone}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text(`Rapport d'activité — ${fmtDate(date)}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#B85042');
    doc.moveDown(0.8);

    // --- Résumé Encaissements ---
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#B85042').text('Encaissements du jour');
    doc.fillColor('#000000');
    doc.moveDown(0.3);

    doc.fontSize(22).font('Helvetica-Bold').text(fmtCurrency(report.totalEncaisse));
    doc.fontSize(10).font('Helvetica').text(`${report.totalOrders} commande(s) au total`);
    if (report.voucherCount > 0) {
      doc.fillColor('#92400E').text(`+ ${report.voucherCount} bon(s) propriétaire : ${fmtCurrency(report.voucherTotal)}`);
      doc.fillColor('#000000');
    }
    doc.moveDown(0.8);

    // --- Par mode de paiement ---
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Par mode de paiement');
    doc.fillColor('#000000');
    doc.moveDown(0.3);

    const colW = [200, 100, 150];
    const drawTableRow = (cells: string[], bold = false) => {
      const y = doc.y;
      const font = bold ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(font).fontSize(10);
      let x = 40;
      cells.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colW[i], align: i === 0 ? 'left' : 'right' });
        x += colW[i] + 10;
      });
      doc.moveDown(0.1);
    };

    drawTableRow(['Mode', 'Transactions', 'Montant'], true);
    doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
    doc.moveDown(0.2);

    for (const [method, info] of Object.entries(report.byMethod) as [string, any][]) {
      drawTableRow([PAYMENT_LABELS[method] || method, String(info.count), fmtCurrency(info.total)]);
    }
    doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
    doc.moveDown(0.1);
    drawTableRow(['TOTAL', '', fmtCurrency(report.totalEncaisse)], true);
    doc.moveDown(0.8);

    // --- Décaissements du jour ---
    const totalDecaisse = Number(report.totalDecaisse || 0);
    const expenseDetails: any[] = report.expenseDetails || [];
    const expenseByMethod: Record<string, { count: number; total: number }> = report.expenseByMethod || {};
    const expenseByCategory: Record<string, { count: number; total: number }> = report.expenseByCategory || {};

    if (doc.y > 680) doc.addPage();
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#B85042').text('Décaissements du jour');
    doc.fillColor('#000000');
    doc.moveDown(0.3);

    if (expenseDetails.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text('Aucun décaissement enregistré.');
      doc.fillColor('#000000');
      doc.moveDown(0.8);
    } else {
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#B85042').text(fmtCurrency(totalDecaisse));
      doc.fillColor('#000000');
      doc.fontSize(10).font('Helvetica').text(`${expenseDetails.length} décaissement(s) au total`);
      doc.moveDown(0.5);

      // Par mode
      doc.fontSize(11).font('Helvetica-Bold').text('Par mode de paiement');
      doc.moveDown(0.2);
      drawTableRow(['Mode', 'Transactions', 'Montant'], true);
      doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
      doc.moveDown(0.2);
      for (const [method, info] of Object.entries(expenseByMethod)) {
        drawTableRow([PAYMENT_LABELS[method] || method, String(info.count), fmtCurrency(info.total)]);
      }
      doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
      doc.moveDown(0.1);
      drawTableRow(['TOTAL', '', fmtCurrency(totalDecaisse)], true);
      doc.moveDown(0.5);

      // Par catégorie
      const CATEGORY_LABELS: Record<string, string> = {
        SUPPLIES: 'Fournitures', SALARY: 'Salaires', UTILITIES: 'Électricité/Eau',
        RENT: 'Loyer', MAINTENANCE: 'Entretien', TRANSPORT: 'Transport',
        MARKETING: 'Marketing', OTHER: 'Autre',
      };
      if (Object.keys(expenseByCategory).length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('Par catégorie');
        doc.moveDown(0.2);
        drawTableRow(['Catégorie', 'Transactions', 'Montant'], true);
        doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
        doc.moveDown(0.2);
        for (const [cat, info] of Object.entries(expenseByCategory)) {
          drawTableRow([CATEGORY_LABELS[cat] || cat, String(info.count), fmtCurrency(info.total)]);
        }
        doc.moveDown(0.5);
      }

      // Détail
      if (doc.y > 680) doc.addPage();
      doc.fontSize(11).font('Helvetica-Bold').text('Détail des décaissements');
      doc.moveDown(0.2);
      const expW = [60, 200, 70, 80, 70];
      const drawExpRow = (cells: string[], bold = false) => {
        const startY = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        let x = 40;
        let maxH = 0;
        cells.forEach((cell, i) => {
          const opts = { width: expW[i], align: (i === 3 ? 'right' : 'left') as 'right' | 'left' };
          const h = doc.heightOfString(cell, opts);
          doc.text(cell, x, startY, opts);
          if (h > maxH) maxH = h;
          x += expW[i] + 5;
        });
        doc.y = startY + maxH + 2;
      };
      drawExpRow(['Catégorie', 'Motif', 'Mode', 'Montant', 'Saisi par'], true);
      doc.moveTo(40, doc.y).lineTo(535, doc.y).stroke('#E5E7EB');
      doc.moveDown(0.15);
      for (const e of expenseDetails) {
        if (doc.y > 750) doc.addPage();
        drawExpRow([
          CATEGORY_LABELS[e.category] || e.category || '-',
          e.reason || '-',
          PAYMENT_LABELS[e.method] || e.method || '-',
          fmtCurrency(e.amount),
          e.performer || '-',
        ]);
      }
      doc.moveDown(0.8);
    }

    // --- Solde du jour (encaissements - décaissements) ---
    if (doc.y > 700) doc.addPage();
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#B85042');
    doc.moveDown(0.4);
    const solde = report.totalEncaisse - totalDecaisse;
    const soldeColor = solde >= 0 ? '#065F46' : '#991B1B';
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text('Solde du jour', 40, doc.y, { continued: true });
    doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text('  (encaissements - décaissements)');
    doc.fillColor('#000000').moveDown(0.2);
    doc.fontSize(11).font('Helvetica').fillColor('#374151');
    drawTableRow(['Total encaissé', '', fmtCurrency(report.totalEncaisse)]);
    drawTableRow(['Total décaissé', '', `- ${fmtCurrency(totalDecaisse)}`]);
    doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
    doc.moveDown(0.1);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(soldeColor);
    drawTableRow(['SOLDE', '', fmtCurrency(solde)], true);
    doc.fillColor('#000000');
    doc.moveDown(0.8);

    // --- Par serveur ---
    if (report.byServer.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Performance par serveur');
      doc.fillColor('#000000');
      doc.moveDown(0.3);

      drawTableRow(['Serveur', 'Commandes', 'CA généré'], true);
      doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
      doc.moveDown(0.2);
      for (const s of report.byServer) {
        drawTableRow([s.name, String(s.count), fmtCurrency(s.revenue)]);
      }
      doc.moveDown(0.8);
    }

    // --- Détail des transactions ---
    if (report.paymentDetails.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Détail des transactions');
      doc.fillColor('#000000');
      doc.moveDown(0.3);

      const detailW = [95, 105, 85, 75, 85, 45];
      const drawDetailRow = (cells: string[], bold = false) => {
        const startY = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        let x = 40;
        let maxH = 0;
        cells.forEach((cell, i) => {
          const opts = { width: detailW[i], align: (i >= 4 ? 'right' : 'left') as 'right' | 'left' };
          const h = doc.heightOfString(cell, opts);
          doc.text(cell, x, startY, opts);
          if (h > maxH) maxH = h;
          x += detailW[i] + 5;
        });
        doc.y = startY + maxH + 2;
      };

      drawDetailRow(['Facture', 'Commande', 'Serveur', 'Mode', 'Montant', 'Heure'], true);
      doc.moveTo(40, doc.y).lineTo(535, doc.y).stroke('#E5E7EB');
      doc.moveDown(0.15);

      for (const d of report.paymentDetails) {
        if (doc.y > 750) doc.addPage();
        drawDetailRow([
          d.invoiceNumber,
          d.orderNumber,
          d.server,
          PAYMENT_LABELS[d.method] || d.method,
          fmtCurrency(d.amount),
          fmtTime(d.time),
        ]);
      }
    }

    // --- Statuts des commandes ---
    if (Object.keys(report.byStatus).length > 0) {
      doc.moveDown(0.8);
      if (doc.y > 680) doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Commandes par statut');
      doc.fillColor('#000000');
      doc.moveDown(0.3);

      const STATUS_LABELS: Record<string, string> = {
        PENDING: 'En attente', IN_PROGRESS: 'En cours', READY: 'Prêt',
        SERVED: 'Servi', CANCELLED: 'Annulé',
      };
      for (const [status, count] of Object.entries(report.byStatus)) {
        doc.fontSize(10).font('Helvetica').text(`${STATUS_LABELS[status] || status} : ${count}`, 60);
      }
    }

    // --- Footer ---
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#9CA3AF').text(
      `Rapport généré le ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Lome' })} — Teranga PMS`,
      40, doc.y, { align: 'center' }
    );

    doc.end();
  });
}

// --- Build range report (multi-day) ---
async function buildRangeReport(tenantId: string, from: string, to: string, establishmentId?: string) {
  const db = createTenantClient(tenantId);
  const rangeStart = new Date(`${from}T00:00:00.000Z`);
  const rangeEnd = new Date(`${to}T23:59:59.999Z`);

  const estFilter: any = establishmentId
    ? {
        invoice: {
          OR: [
            { orders: { some: { establishmentId } } },
            { reservation: { room: { establishmentId } } },
          ],
        },
      }
    : {};

  // Orders in range — used for the encaissement totals (matches CSV).
  // Bucketed by operationDate (declared business date).
  const orderEstFilter = establishmentId ? { establishmentId } : {};
  const orders = await db.order.findMany({
    where: {
      tenantId,
      operationDate: { gte: rangeStart, lte: rangeEnd },
      ...orderEstFilter,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      server: { select: { id: true, firstName: true, lastName: true } },
      invoice: { select: { status: true } },
    },
    orderBy: { operationDate: 'asc' },
  });

  // Reservation payments still come from the Payment table — bucket by paidAt.
  const payments = await db.payment.findMany({
    where: {
      tenantId,
      paidAt: { gte: rangeStart, lte: rangeEnd },
      ...estFilter,
    },
    include: {
      invoice: {
        select: {
          isVoucher: true,
          reservationId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by day
  const days: Record<string, { total: number; voucherTotal: number; count: number; voucherCount: number; byMethod: Record<string, number> }> = {};

  // Initialize all days in range
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const key = cursor.toISOString().slice(0, 10);
    days[key] = { total: 0, voucherTotal: 0, count: 0, voucherCount: 0, byMethod: {} };
    cursor.setDate(cursor.getDate() + 1);
  }

  let grandTotal = 0;
  let grandVoucher = 0;
  const grandByMethod: Record<string, { count: number; total: number }> = {};
  const grandByServer: Record<string, { name: string; count: number; revenue: number }> = {};

  // Walk orders for encaissements + per-server breakdown
  for (const o of orders) {
    const day = ((o as any).operationDate ?? o.createdAt).toISOString().slice(0, 10);
    const amount = Number(o.totalAmount);

    if (!days[day]) days[day] = { total: 0, voucherTotal: 0, count: 0, voucherCount: 0, byMethod: {} };

    if ((o as any).isVoucher) {
      days[day].voucherTotal += amount;
      days[day].voucherCount++;
      grandVoucher += amount;
      continue;
    }
    if ((o as any).invoice?.status !== 'PAID') continue;

    const method = o.paymentMethod || 'NON_DEFINI';
    days[day].total += amount;
    days[day].count++;
    days[day].byMethod[method] = (days[day].byMethod[method] || 0) + amount;
    grandTotal += amount;

    if (!grandByMethod[method]) grandByMethod[method] = { count: 0, total: 0 };
    grandByMethod[method].count++;
    grandByMethod[method].total += amount;

    const attributed = (o as any).server || (o as any).createdBy;
    if (attributed) {
      const key = (attributed as any).id;
      const name = `${(attributed as any).firstName} ${(attributed as any).lastName}`;
      if (!grandByServer[key]) grandByServer[key] = { name, count: 0, revenue: 0 };
      grandByServer[key].count++;
      grandByServer[key].revenue += amount;
    }
  }

  // Reservation payments add to the totals for the day they were paid.
  for (const p of payments as any[]) {
    if (!p.invoice?.reservationId || p.invoice?.isVoucher) continue;
    const day = (p.paidAt as Date).toISOString().slice(0, 10);
    const amount = Number(p.amount);
    const method = p.method || 'CASH';
    if (!days[day]) days[day] = { total: 0, voucherTotal: 0, count: 0, voucherCount: 0, byMethod: {} };
    days[day].total += amount;
    days[day].count++;
    days[day].byMethod[method] = (days[day].byMethod[method] || 0) + amount;
    grandTotal += amount;
    if (!grandByMethod[method]) grandByMethod[method] = { count: 0, total: 0 };
    grandByMethod[method].count++;
    grandByMethod[method].total += amount;
  }

  // Expenses over the same range — bucketed by operationDate
  const expenses = await db.expense.findMany({
    where: {
      tenantId,
      deletedAt: null,
      operationDate: { gte: rangeStart, lte: rangeEnd },
      ...(establishmentId && { establishmentId }),
    },
    orderBy: { operationDate: 'asc' },
  });

  const expensesByDay: Record<string, { total: number; count: number }> = {};
  let grandDecaisse = 0;
  for (const e of expenses) {
    const day = e.operationDate.toISOString().slice(0, 10);
    if (!expensesByDay[day]) expensesByDay[day] = { total: 0, count: 0 };
    const amount = Number(e.amount);
    expensesByDay[day].total += amount;
    expensesByDay[day].count++;
    grandDecaisse += amount;
  }

  const daysWithNet = Object.entries(days).map(([date, d]) => {
    const exp = expensesByDay[date] ?? { total: 0, count: 0 };
    return {
      date,
      ...d,
      decaisse: exp.total,
      decaisseCount: exp.count,
      net: d.total - exp.total,
    };
  });

  return {
    from,
    to,
    days: daysWithNet,
    grandTotal,
    grandVoucher,
    grandPayments: orders.filter((o: any) => !o.isVoucher && !['CANCELLED', 'PENDING'].includes(o.status)).length + payments.filter((p: any) => p.invoice?.reservationId && !p.invoice?.isVoucher).length,
    grandByMethod,
    grandByServer: Object.values(grandByServer).sort((a, b) => b.revenue - a.revenue),
    grandDecaisse,
    grandDecaisseCount: expenses.length,
    grandNet: grandTotal - grandDecaisse,
  };
}

// --- Generate range PDF ---
async function generateRangeReportPdf(tenantId: string, report: any, from: string, to: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const db = createTenantClient(tenantId);
  const establishment = await db.establishment.findFirst({ select: { name: true, address: true, phone: true } });
  const estName = establishment?.name || 'Établissement';

  const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Espèces', CARD: 'Carte', BANK_TRANSFER: 'Virement',
    MOBILE_MONEY: 'Mobile Money', MOOV_MONEY: 'Flooz', MIXX_BY_YAS: 'Yas (MTN)',
    FEDAPAY: 'FedaPay', OTHER: 'Autre',
  };
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[\u202F\u00A0]/g, ' ') + ' FCFA';
  const fmtDateShort = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDateLong = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(estName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(establishment?.address || '', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text(`Rapport comptable — ${fmtDateLong(from)} au ${fmtDateLong(to)}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#B85042');
    doc.moveDown(0.8);

    // Grand totals
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#B85042').text('Résumé de la période');
    doc.fillColor('#000000');
    doc.moveDown(0.3);
    doc.fontSize(22).font('Helvetica-Bold').text(fmtCurrency(report.grandTotal));
    doc.fontSize(10).font('Helvetica').text(`${report.grandPayments} paiement(s) sur ${report.days.length} jour(s)`);
    if (report.grandVoucher > 0) {
      doc.fillColor('#92400E').text(`Bons propriétaire : ${fmtCurrency(report.grandVoucher)} (non comptabilisés dans le CA)`);
      doc.fillColor('#000000');
    }
    doc.moveDown(0.8);

    // Daily breakdown table
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Détail par jour');
    doc.fillColor('#000000');
    doc.moveDown(0.3);

    const colW = [80, 80, 100, 100, 80];
    const drawRow = (cells: string[], bold = false) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      let x = 40;
      cells.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colW[i], align: i === 0 ? 'left' : 'right' });
        x += colW[i] + 8;
      });
      doc.moveDown(0.1);
    };

    drawRow(['Date', 'Paiements', 'Encaissé', 'Décaissé', 'Solde'], true);
    doc.moveTo(40, doc.y).lineTo(530, doc.y).stroke('#E5E7EB');
    doc.moveDown(0.15);

    for (const day of report.days) {
      if (doc.y > 720) doc.addPage();
      const hasData = day.count > 0 || day.voucherCount > 0 || day.decaisseCount > 0;
      if (hasData) {
        drawRow([
          fmtDateShort(day.date),
          String(day.count),
          fmtCurrency(day.total),
          day.decaisse > 0 ? `- ${fmtCurrency(day.decaisse)}` : '-',
          fmtCurrency(day.net),
        ]);
      }
    }
    doc.moveTo(40, doc.y).lineTo(530, doc.y).stroke('#E5E7EB');
    doc.moveDown(0.1);
    drawRow([
      'TOTAL',
      '',
      fmtCurrency(report.grandTotal),
      `- ${fmtCurrency(report.grandDecaisse || 0)}`,
      fmtCurrency(report.grandNet ?? report.grandTotal),
    ], true);
    doc.moveDown(0.8);

    // Bilan global avec ligne Solde
    if (doc.y > 680) doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Solde de la période');
    doc.fillColor('#000000');
    doc.moveDown(0.3);
    const soldeRange = (report.grandTotal || 0) - (report.grandDecaisse || 0);
    const soldeRangeColor = soldeRange >= 0 ? '#065F46' : '#991B1B';
    const sColW = [200, 100, 150];
    const drawBilanRow = (cells: string[], bold = false, color = '#000000') => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(color);
      let x = 40;
      cells.forEach((cell, i) => {
        doc.text(cell, x, y, { width: sColW[i], align: i === 0 ? 'left' : 'right' });
        x += sColW[i] + 10;
      });
      doc.fillColor('#000000');
      doc.moveDown(0.1);
    };
    drawBilanRow(['Total encaissé', '', fmtCurrency(report.grandTotal)]);
    drawBilanRow(['Total décaissé', '', `- ${fmtCurrency(report.grandDecaisse || 0)}`]);
    if (report.grandVoucher > 0) {
      drawBilanRow(['Bons propriétaire (info)', '', fmtCurrency(report.grandVoucher)], false, '#92400E');
    }
    doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
    doc.moveDown(0.1);
    drawBilanRow(['SOLDE', '', fmtCurrency(soldeRange)], true, soldeRangeColor);
    doc.moveDown(0.8);

    // By payment method
    if (Object.keys(report.grandByMethod).length > 0) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Par mode de paiement');
      doc.fillColor('#000000');
      doc.moveDown(0.3);

      const mColW = [200, 100, 150];
      const drawMRow = (cells: string[], bold = false) => {
        const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
        let x = 40;
        cells.forEach((cell, i) => {
          doc.text(cell, x, y, { width: mColW[i], align: i === 0 ? 'left' : 'right' });
          x += mColW[i] + 10;
        });
        doc.moveDown(0.1);
      };

      drawMRow(['Mode', 'Transactions', 'Montant'], true);
      doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
      doc.moveDown(0.15);
      for (const [method, info] of Object.entries(report.grandByMethod) as [string, any][]) {
        drawMRow([PAYMENT_LABELS[method] || method, String(info.count), fmtCurrency(info.total)]);
      }
      doc.moveDown(0.8);
    }

    // By server
    if (report.grandByServer.length > 0) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#B85042').text('Performance par serveur');
      doc.fillColor('#000000');
      doc.moveDown(0.3);

      const sColW = [200, 100, 150];
      const drawSRow = (cells: string[], bold = false) => {
        const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
        let x = 40;
        cells.forEach((cell, i) => {
          doc.text(cell, x, y, { width: sColW[i], align: i === 0 ? 'left' : 'right' });
          x += sColW[i] + 10;
        });
        doc.moveDown(0.1);
      };

      drawSRow(['Serveur', 'Commandes', 'CA généré'], true);
      doc.moveTo(40, doc.y).lineTo(500, doc.y).stroke('#E5E7EB');
      doc.moveDown(0.15);
      for (const s of report.grandByServer) {
        drawSRow([s.name, String(s.count), fmtCurrency(s.revenue)]);
      }
    }

    // Footer
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#9CA3AF').text(
      `Rapport généré le ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Lome' })} — Teranga PMS`,
      40, doc.y, { align: 'center' }
    );

    doc.end();
  });
}

// --- Client "Carte de fidélité" PDF ---
async function generateClientPdf(tenantId: string, clientId: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const client = await clientService.getById(tenantId, clientId);
  const db = createTenantClient(tenantId);
  const establishment = await db.establishment.findFirst({ select: { name: true, address: true, phone: true } });
  const estName = establishment?.name || 'Établissement';
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[\u202F\u00A0]/g, ' ') + ' FCFA';
  const fmtDate = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(estName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(establishment?.address || '', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text('Carte de fidélité', { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#B85042');
    doc.moveDown(0.8);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#111827').text(`${client.firstName} ${client.lastName}`);
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').fillColor('#6B7280');
    if (client.email) doc.text(`Email : ${client.email}`);
    if (client.phone) doc.text(`Téléphone : ${client.phone}`);
    doc.text(`Source : ${client.source}`);
    doc.moveDown(0.8);

    const tierColors: Record<string, string> = { FIDELE: '#D4A857', NEW: '#7A9E88' };
    const tierLabels: Record<string, string> = { FIDELE: 'CLIENT FIDÈLE', NEW: 'Nouveau client' };
    const tier = client.stats.fidelityTier;
    doc.fontSize(12).font('Helvetica-Bold').fillColor(tierColors[tier] || '#000').text(`Statut fidélité : ${tierLabels[tier] || tier}`);
    if (!client.stats.isFidele) {
      const remaining = Math.max(0, 5 - (client.stats.paidReservations || 0));
      doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text(
        `Encore ${remaining} réservation${remaining > 1 ? 's' : ''} payée${remaining > 1 ? 's' : ''} pour devenir client fidèle.`
      );
    }
    doc.moveDown(0.5);
    doc.fillColor('#000');

    doc.fontSize(12).font('Helvetica-Bold').text('Statistiques');
    doc.fontSize(10).font('Helvetica');
    doc.text(`CA total : ${fmtCurrency(client.stats.totalRevenue)}`);
    doc.text(`Réservations payées : ${client.stats.paidReservations}`);
    doc.text(`Séjours complétés : ${client.stats.totalStays}`);
    doc.text(`Réservations totales : ${client.stats.totalReservations}`);
    doc.text(`Factures : ${client.stats.totalInvoices}`);
    doc.text(`Dernière visite : ${fmtDate(client.stats.lastVisit)}`);
    doc.moveDown(0.8);

    doc.fontSize(12).font('Helvetica-Bold').text('Historique des séjours');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    (client.reservations || []).slice(0, 20).forEach((r: any) => {
      doc.text(`• ${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)}  —  Ch. ${r.room?.number || '?'}  —  ${r.status}  —  ${fmtCurrency(Number(r.totalPrice))}`);
    });

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#9CA3AF').text(
      `Généré le ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Lome' })} — Teranga PMS`,
      40, doc.y, { align: 'center' }
    );
    doc.end();
  });
}
