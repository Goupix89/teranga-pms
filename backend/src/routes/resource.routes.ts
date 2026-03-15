import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authenticateApiKey } from '../middlewares/auth.middleware';
import { requireRole, requireManager, requireAdmin, requireSuperAdmin, requireAnyRole, requireSelfOrRole } from '../middlewares/rbac.middleware';
import { validate, validateQuery } from '../middlewares/validate.middleware';
import { parsePagination } from '../utils/helpers';
import * as v from '../validators';

import { userService, establishmentService, supplierService, articleService, categoryService } from '../services/crud.service';
import { roomService } from '../services/room.service';
import { reservationService } from '../services/reservation.service';
import { invoiceService } from '../services/invoice.service';
import { paymentService } from '../services/payment.service';
import { stockService } from '../services/stock.service';

// Helper to wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// =============================================================================
// USERS
// =============================================================================
export const userRouter = Router();

userRouter.get('/', authenticate, requireManager,
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

userRouter.get('/:id', authenticate, requireSelfOrRole('SUPERADMIN', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = await userService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// SUPERADMIN & ADMIN can create any user; MANAGER can create EMPLOYEE only (pending approval)
userRouter.post('/', authenticate, requireManager, validate(v.createUserSchema),
  asyncHandler(async (req, res) => {
    const data = await userService.create(req.user!.tenantId, req.body, req.user!.role, req.user!.establishmentIds);
    res.status(201).json({ success: true, data });
  })
);

// Approve a pending user (ADMIN+ only)
userRouter.post('/:id/approve', authenticate, requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await userService.approve(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

userRouter.patch('/:id', authenticate, requireSelfOrRole('SUPERADMIN', 'ADMIN'),
  validate(v.updateUserSchema),
  asyncHandler(async (req, res) => {
    const data = await userService.update(req.user!.tenantId, req.params.id, req.body, req.user!.role);
    res.json({ success: true, data });
  })
);

userRouter.delete('/:id', authenticate, requireAdmin,
  asyncHandler(async (req, res) => {
    await userService.archive(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Utilisateur archivé' });
  })
);

// =============================================================================
// ESTABLISHMENTS
// =============================================================================
export const establishmentRouter = Router();

establishmentRouter.get('/', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const data = await establishmentService.list(req.user!.tenantId, params, req.user!.establishmentIds);
    res.json({ success: true, ...data });
  })
);

establishmentRouter.get('/:id', authenticate, requireAnyRole,
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

establishmentRouter.patch('/:id', authenticate, requireAdmin, validate(v.updateEstablishmentSchema),
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
// ROOMS
// =============================================================================
export const roomRouter = Router();

roomRouter.get('/', authenticate, requireAnyRole,
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

roomRouter.get('/:id', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await roomService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

roomRouter.post('/', authenticate, requireManager, validate(v.createRoomSchema),
  asyncHandler(async (req, res) => {
    const data = await roomService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

roomRouter.patch('/:id', authenticate, requireManager, validate(v.updateRoomSchema),
  asyncHandler(async (req, res) => {
    const data = await roomService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

roomRouter.patch('/:id/status', authenticate, requireAnyRole, validate(v.updateRoomStatusSchema),
  asyncHandler(async (req, res) => {
    const data = await roomService.updateStatus(req.user!.tenantId, req.params.id, req.body.status);
    res.json({ success: true, data });
  })
);

roomRouter.delete('/:id', authenticate, requireManager,
  asyncHandler(async (req, res) => {
    await roomService.delete(req.user!.tenantId, req.params.id);
    res.json({ success: true, message: 'Chambre désactivée' });
  })
);

// =============================================================================
// RESERVATIONS
// =============================================================================
export const reservationRouter = Router();

reservationRouter.get('/', authenticate, requireAnyRole,
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

reservationRouter.get('/:id', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await reservationService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

reservationRouter.post('/', authenticate, requireAnyRole, validate(v.createReservationSchema),
  asyncHandler(async (req, res) => {
    const data = await reservationService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

reservationRouter.patch('/:id', authenticate, requireManager, validate(v.updateReservationSchema),
  asyncHandler(async (req, res) => {
    const data = await reservationService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

reservationRouter.post('/:id/check-in', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await reservationService.checkIn(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

reservationRouter.post('/:id/check-out', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await reservationService.checkOut(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

reservationRouter.post('/:id/cancel', authenticate, requireManager,
  asyncHandler(async (req, res) => {
    const data = await reservationService.cancel(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// INVOICES
// =============================================================================
export const invoiceRouter = Router();

invoiceRouter.get('/', authenticate, requireAnyRole,
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

invoiceRouter.get('/:id', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await invoiceService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

invoiceRouter.post('/', authenticate, requireAnyRole, validate(v.createInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.create(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  })
);

invoiceRouter.patch('/:id', authenticate, requireManager, validate(v.updateInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

invoiceRouter.post('/:id/issue', authenticate, requireManager,
  asyncHandler(async (req, res) => {
    const data = await invoiceService.issue(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

invoiceRouter.post('/:id/cancel', authenticate, requireRole('SUPERADMIN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await invoiceService.cancel(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// PAYMENTS
// =============================================================================
export const paymentRouter = Router();

paymentRouter.post('/', authenticate, requireAnyRole, validate(v.createPaymentSchema),
  asyncHandler(async (req, res) => {
    const { payment, alreadyProcessed } = await paymentService.create(req.user!.tenantId, req.body);
    res.status(alreadyProcessed ? 200 : 201).json({ success: true, data: payment });
  })
);

paymentRouter.get('/invoice/:invoiceId', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await paymentService.listByInvoice(req.user!.tenantId, req.params.invoiceId);
    res.json({ success: true, data });
  })
);

// =============================================================================
// ARTICLES
// =============================================================================
export const articleRouter = Router();

articleRouter.get('/', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const { categoryId, search, lowStock } = req.query as any;
    const data = await articleService.list(req.user!.tenantId, params, { categoryId, search, lowStock: lowStock === 'true' });
    res.json({ success: true, ...data });
  })
);

articleRouter.get('/low-stock', authenticate, requireManager,
  asyncHandler(async (req, res) => {
    const data = await articleService.getLowStock(req.user!.tenantId);
    res.json({ success: true, data });
  })
);

articleRouter.get('/:id', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await articleService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

articleRouter.post('/', authenticate, requireManager, validate(v.createArticleSchema),
  asyncHandler(async (req, res) => {
    const data = await articleService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

articleRouter.patch('/:id', authenticate, requireManager, validate(v.updateArticleSchema),
  asyncHandler(async (req, res) => {
    const data = await articleService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

// =============================================================================
// CATEGORIES
// =============================================================================
export const categoryRouter = Router();

categoryRouter.get('/', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await categoryService.list(req.user!.tenantId);
    res.json({ success: true, data });
  })
);

categoryRouter.post('/', authenticate, requireManager, validate(v.createCategorySchema),
  asyncHandler(async (req, res) => {
    const data = await categoryService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

categoryRouter.patch('/:id', authenticate, requireManager, validate(v.updateCategorySchema),
  asyncHandler(async (req, res) => {
    const data = await categoryService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

// =============================================================================
// STOCK MOVEMENTS
// =============================================================================
export const stockMovementRouter = Router();

stockMovementRouter.get('/', authenticate, requireAnyRole,
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

stockMovementRouter.post('/', authenticate, requireAnyRole, validate(v.createStockMovementSchema),
  asyncHandler(async (req, res) => {
    const data = await stockService.createMovement(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, ...data });
  })
);

stockMovementRouter.post('/:id/approve', authenticate, requireManager,
  asyncHandler(async (req, res) => {
    const data = await stockService.approveMovement(req.user!.tenantId, req.params.id, req.user!.id);
    res.json({ success: true, data });
  })
);

// =============================================================================
// SUPPLIERS
// =============================================================================
export const supplierRouter = Router();

supplierRouter.get('/', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const params = parsePagination(req);
    const data = await supplierService.list(req.user!.tenantId, params, req.query.search as string);
    res.json({ success: true, ...data });
  })
);

supplierRouter.get('/:id', authenticate, requireAnyRole,
  asyncHandler(async (req, res) => {
    const data = await supplierService.getById(req.user!.tenantId, req.params.id);
    res.json({ success: true, data });
  })
);

supplierRouter.post('/', authenticate, requireManager, validate(v.createSupplierSchema),
  asyncHandler(async (req, res) => {
    const data = await supplierService.create(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  })
);

supplierRouter.patch('/:id', authenticate, requireManager, validate(v.updateSupplierSchema),
  asyncHandler(async (req, res) => {
    const data = await supplierService.update(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  })
);

supplierRouter.delete('/:id', authenticate, requireManager,
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
integrationRouter.post('/pos/transactions', authenticate, requireAnyRole, validate(v.posTransactionSchema),
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
