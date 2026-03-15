import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authenticateApiKey } from '../middlewares/auth.middleware';
import {
  requireSuperAdmin,
  requireAuthenticated,
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
import { invoiceService } from '../services/invoice.service';
import { paymentService } from '../services/payment.service';
import { stockService } from '../services/stock.service';
import { orderService } from '../services/order.service';
import { approvalService } from '../services/approval.service';
import { cleaningService } from '../services/cleaning.service';
import { stockAlertService } from '../services/stock-alert.service';
import { memberService } from '../services/member.service';

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
    // Determine the requesting user's establishment role
    const estId = req.body.establishmentIds?.[0];
    const estRole = estId ? getEstablishmentRole(req, estId) : null;
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

userRouter.patch('/:id', authenticate, requireSelfOrRole('DAF'),
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
    const data = await establishmentService.list(req.user!.tenantId, params, req.user!.establishmentIds);
    res.json({ success: true, ...data });
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

establishmentRouter.patch('/:id', authenticate, requireDAF, validate(v.updateEstablishmentSchema),
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

reservationRouter.get('/:id', authenticate, requireAnyEstablishmentRole,
  asyncHandler(async (req, res) => {
    const data = await reservationService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// DAF + MANAGER can create reservations
reservationRouter.post('/', authenticate, requireDAFOrManager, validate(v.createReservationSchema),
  asyncHandler(async (req, res) => {
    const data = await reservationService.create(req.user!.tenantId, req.body);
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
    const { establishmentId, status, from, to } = req.query as any;
    const data = await orderService.list(req.user!.tenantId, params, {
      establishmentId, status, from, to,
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
    const { categoryId, search, lowStock } = req.query as any;
    const data = await articleService.list(req.user!.tenantId, params, { categoryId, search, lowStock: lowStock === 'true' });
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

// DAF and MANAGER can create articles
articleRouter.post('/', authenticate, requireDAFOrManager, validate(v.createArticleSchema),
  asyncHandler(async (req, res) => {
    const data = await articleService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
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
    const data = await categoryService.list(req.user!.tenantId);
    res.json({ success: true, data });
  })
);

categoryRouter.post('/', authenticate, requireDAF, validate(v.createCategorySchema),
  asyncHandler(async (req, res) => {
    const data = await categoryService.create(req.user!.tenantId, req.body);
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
    const { room, start, end, guest, source, externalRef } = req.body;

    // Resolve room by number
    const { prisma } = await import('../utils/prisma');
    const roomEntity = await prisma.room.findFirst({
      where: { tenantId: req.tenantId!, number: room, isActive: true },
    });

    if (!roomEntity) {
      return res.status(404).json({ success: false, error: `Chambre ${room} introuvable` });
    }

    const reservation = await reservationService.create(req.tenantId!, {
      roomId: roomEntity.id,
      guestName: guest,
      checkIn: start,
      checkOut: end,
      numberOfGuests: 1,
      source: source || 'CHANNEL_MANAGER',
      externalRef,
    });

    res.status(201).json({
      id: reservation.id,
      room: room,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      status: reservation.status,
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
