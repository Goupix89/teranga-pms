import { z } from 'zod';

// =============================================================================
// Common
// =============================================================================

export const uuidParam = z.object({
  id: z.string().uuid('ID invalide'),
});

// =============================================================================
// Auth
// =============================================================================

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
});

// =============================================================================
// Tenant
// =============================================================================

export const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(3).max(63).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug invalide (minuscules, chiffres, tirets)'),
  plan: z.enum(['basic', 'pro', 'enterprise']).default('basic'),
  settings: z.record(z.unknown()).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  plan: z.enum(['basic', 'pro', 'enterprise']).optional(),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// User
// =============================================================================

export const establishmentRoleEnum = z.enum(['DAF', 'MANAGER', 'SERVER', 'POS', 'COOK', 'CLEANER']);

export const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Numéro invalide').optional(),
  establishmentIds: z.array(z.string().uuid()).optional(),
  establishmentRole: establishmentRoleEnum.optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Numéro invalide').optional().nullable(),
  status: z.enum(['ACTIVE', 'PENDING_APPROVAL', 'LOCKED']).optional(),
  establishmentIds: z.array(z.string().uuid()).optional(),
  establishmentRole: establishmentRoleEnum.optional(),
});

// =============================================================================
// Establishment
// =============================================================================

export const createEstablishmentSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(5).max(500),
  city: z.string().min(1).max(100),
  country: z.string().min(2).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  timezone: z.string().default('UTC'),
  currency: z.string().length(3).default('XOF'),
});

export const updateEstablishmentSchema = createEstablishmentSchema.partial();

// =============================================================================
// Room
// =============================================================================

export const createRoomSchema = z.object({
  establishmentId: z.string().uuid(),
  number: z.string().min(1).max(20),
  floor: z.number().int().min(-5).max(200).optional(),
  type: z.enum(['SINGLE', 'DOUBLE', 'SUITE', 'FAMILY', 'DELUXE']),
  pricePerNight: z.number().positive().max(99999999),
  maxOccupancy: z.number().int().min(1).max(20).default(2),
  amenities: z.array(z.string()).default([]),
  description: z.string().max(1000).optional(),
});

export const updateRoomSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  floor: z.number().int().min(-5).max(200).optional().nullable(),
  type: z.enum(['SINGLE', 'DOUBLE', 'SUITE', 'FAMILY', 'DELUXE']).optional(),
  pricePerNight: z.number().positive().max(99999999).optional(),
  maxOccupancy: z.number().int().min(1).max(20).optional(),
  amenities: z.array(z.string()).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateRoomStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_ORDER', 'CLEANING']),
});

// =============================================================================
// Reservation
// =============================================================================

export const createReservationSchema = z.object({
  roomId: z.string().uuid('ID de chambre invalide'),
  guestName: z.string().min(2, 'Nom trop court').max(200),
  guestEmail: z.string().email('Email invalide').optional(),
  guestPhone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Numéro invalide').optional(),
  checkIn: z.string().date('Format YYYY-MM-DD requis'),
  checkOut: z.string().date('Format YYYY-MM-DD requis'),
  numberOfGuests: z.number().int().min(1).max(20).default(1),
  source: z.enum(['DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'CHANNEL_MANAGER', 'PHONE', 'WALK_IN']).default('DIRECT'),
  notes: z.string().max(1000).optional(),
}).refine(
  (d) => new Date(d.checkOut) > new Date(d.checkIn),
  { message: 'La date de départ doit être après la date d\'arrivée', path: ['checkOut'] }
);

export const updateReservationSchema = z.object({
  guestName: z.string().min(2).max(200).optional(),
  guestEmail: z.string().email().optional().nullable(),
  guestPhone: z.string().regex(/^\+?[0-9]{8,15}$/).optional().nullable(),
  checkIn: z.string().date().optional(),
  checkOut: z.string().date().optional(),
  numberOfGuests: z.number().int().min(1).max(20).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

// =============================================================================
// Invoice
// =============================================================================

export const createInvoiceSchema = z.object({
  reservationId: z.string().uuid().optional(),
  items: z.array(z.object({
    articleId: z.string().uuid().optional(),
    description: z.string().min(1).max(200),
    quantity: z.number().int().positive(),
    unitPrice: z.number().min(0),
  })).min(1, 'Au moins un article requis'),
  taxRate: z.number().min(0).max(100).default(0),
  currency: z.string().length(3).default('XOF'),
  dueDate: z.string().date().optional(),
  notes: z.string().max(500).optional(),
});

export const updateInvoiceSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid().optional(),
    articleId: z.string().uuid().optional(),
    description: z.string().min(1).max(200),
    quantity: z.number().int().positive(),
    unitPrice: z.number().min(0),
  })).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  dueDate: z.string().date().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// =============================================================================
// Payment
// =============================================================================

export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'MOOV_MONEY', 'MIXX_BY_YAS', 'OTHER']),
  reference: z.string().max(100).optional(),
});

// =============================================================================
// POS Transaction
// =============================================================================

export const posTransactionSchema = z.object({
  tenantId: z.string().min(1),
  transactionUuid: z.string().uuid('UUID de transaction invalide'),
  invoiceId: z.string().min(1),
  items: z.array(z.object({
    articleId: z.string().min(1),
    quantity: z.number().int().positive().max(9999),
    unitPrice: z.number().positive().max(999999.99),
  })).min(1, 'Au moins un article requis'),
  totalAmount: z.number().positive(),
  timestamp: z.string().datetime(),
});

// =============================================================================
// External Booking
// =============================================================================

export const externalBookingSchema = z.object({
  room: z.string().min(1, 'Numéro de chambre requis'),
  start: z.string().date(),
  end: z.string().date(),
  guest: z.string().min(1).max(200),
  source: z.enum(['BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'CHANNEL_MANAGER']).default('CHANNEL_MANAGER'),
  externalRef: z.string().max(100).optional(),
}).refine(
  (d) => new Date(d.end) > new Date(d.start),
  { message: 'end doit être après start' }
);

// =============================================================================
// Article / Stock
// =============================================================================

export const createArticleSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  currentStock: z.number().int().min(0).default(0),
  minimumStock: z.number().int().min(0).default(0),
  unit: z.string().max(20).default('pièce'),
});

export const updateArticleSchema = createArticleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().optional().nullable(),
});

export const createStockMovementSchema = z.object({
  articleId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'WASTE', 'RETURN']),
  quantity: z.number().int(),
  unitCost: z.number().min(0).optional(),
  reason: z.string().max(500).optional(),
});

export const approveStockMovementSchema = z.object({});

// =============================================================================
// Supplier
// =============================================================================

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// =============================================================================
// Availability query
// =============================================================================

export const availabilityQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  establishmentId: z.string().uuid().optional(),
});

// =============================================================================
// Registration
// =============================================================================

export const registerTenantSchema = z.object({
  tenantName: z.string().min(2, 'Nom trop court').max(100),
  slug: z.string().min(3, 'Slug trop court').max(63).regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Slug invalide (minuscules, chiffres, tirets)'
  ),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  planSlug: z.enum(['basic', 'pro', 'enterprise']),
  billingInterval: z.enum(['MONTHLY', 'YEARLY']),
});

// =============================================================================
// Order
// =============================================================================

export const createOrderSchema = z.object({
  establishmentId: z.string().uuid(),
  tableNumber: z.string().max(20).optional(),
  items: z.array(z.object({
    articleId: z.string().uuid(),
    quantity: z.number().int().positive().max(999),
  })).min(1, 'Au moins un article requis'),
  notes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'CANCELLED']),
});

// =============================================================================
// Approval Request
// =============================================================================

export const createApprovalSchema = z.object({
  establishmentId: z.string().uuid(),
  type: z.enum(['EMPLOYEE_CREATION', 'RESERVATION_MODIFICATION']),
  payload: z.record(z.unknown()),
  targetId: z.string().uuid().optional(),
});

export const rejectApprovalSchema = z.object({
  reason: z.string().max(500).optional(),
});

// =============================================================================
// Cleaning Session
// =============================================================================

export const clockInSchema = z.object({
  establishmentId: z.string().uuid(),
  roomId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

// =============================================================================
// Stock Alert
// =============================================================================

export const createStockAlertSchema = z.object({
  establishmentId: z.string().uuid(),
  articleId: z.string().uuid(),
  message: z.string().min(1).max(500),
});

// =============================================================================
// Establishment Member
// =============================================================================

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: establishmentRoleEnum,
});

export const updateMemberRoleSchema = z.object({
  role: establishmentRoleEnum,
});
