// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// Enums
// =============================================================================

export type UserRole = 'SUPERADMIN' | 'EMPLOYEE';
export type EstablishmentRole = 'OWNER' | 'DAF' | 'MANAGER' | 'MAITRE_HOTEL' | 'SERVER' | 'POS' | 'COOK' | 'CLEANER';
export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'LOCKED' | 'ARCHIVED';
export type RoomType = 'SINGLE' | 'DOUBLE' | 'SUITE' | 'FAMILY' | 'DELUXE';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OUT_OF_ORDER' | 'CLEANING';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'MOOV_MONEY' | 'MIXX_BY_YAS' | 'FEDAPAY' | 'OTHER';
export type StockMovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'WASTE' | 'RETURN';
export type BookingSource = 'DIRECT' | 'BOOKING_COM' | 'EXPEDIA' | 'AIRBNB' | 'CHANNEL_MANAGER' | 'PHONE' | 'WALK_IN';
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SERVED' | 'CANCELLED';
export type ApprovalType = 'EMPLOYEE_CREATION' | 'RESERVATION_MODIFICATION' | 'ROOM_CREATION' | 'STOCK_MOVEMENT' | 'ARTICLE_CREATION';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CleaningStatus = 'IN_PROGRESS' | 'COMPLETED';

// =============================================================================
// Auth
// =============================================================================

export interface EstablishmentMembership {
  establishmentId: string;
  establishmentName: string;
  role: EstablishmentRole;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  tenantSlug: string;
  memberships: EstablishmentMembership[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// =============================================================================
// Models
// =============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
  lastLoginAt?: string | null;
  lastActiveAt?: string | null;
  createdAt: string;
  memberships?: Array<{
    establishmentId: string;
    role: EstablishmentRole;
    establishment?: { id: string; name: string };
  }>;
}

export interface Establishment {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  starRating?: number | null;
  timezone: string;
  currency: string;
  isActive: boolean;
  rooms?: Room[];
  _count?: { rooms: number };
}

export interface Room {
  id: string;
  number: string;
  floor?: number | null;
  type: RoomType;
  status: RoomStatus;
  pricePerNight: number;
  maxOccupancy: number;
  amenities: string[];
  description?: string | null;
  isActive: boolean;
  establishment?: { id: string; name: string };
  _count?: { reservations: number };
}

export interface Reservation {
  id: string;
  roomId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  checkIn: string;
  checkOut: string;
  numberOfGuests: number;
  status: ReservationStatus;
  source: BookingSource;
  externalRef?: string | null;
  totalPrice: number;
  notes?: string | null;
  room?: { id: string; number: string; type: RoomType; establishment?: { name: string } };
  invoices?: Invoice[];
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  dueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  items?: InvoiceItem[];
  payments?: Payment[];
  reservation?: { id: string; guestName: string; room?: { number: string } };
  orders?: { id: string; orderNumber: string }[];
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  articleId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  article?: { id: string; name: string; sku?: string | null };
}

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  transactionUuid?: string | null;
  paidAt: string;
}

export interface Article {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  unitPrice: number;
  costPrice: number;
  currentStock: number;
  minimumStock: number;
  unit: string;
  isActive: boolean;
  category?: { id: string; name: string } | null;
}

export interface ArticleCategory {
  id: string;
  name: string;
  parentId?: string | null;
  children?: ArticleCategory[];
  _count?: { articles: number };
}

export interface Supplier {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
}

// =============================================================================
// Subscription
// =============================================================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: {
    maxEstablishments?: number;
    maxRooms?: number;
    maxUsers?: number;
    channelManager?: boolean;
    posApp?: boolean;
  };
  displayOrder: number;
  trialDays?: number;
}

export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'PENDING' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export interface SubscriptionPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
  fedapayTxnId?: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  lastPaymentAt: string | null;
  lastPaymentRef: string | null;
  plan: SubscriptionPlan;
  payments: SubscriptionPayment[];
}

export interface StockMovement {
  id: string;
  articleId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number | null;
  previousStock: number;
  newStock: number;
  reason?: string | null;
  requiresApproval: boolean;
  approvedAt?: string | null;
  article?: { name: string; sku?: string | null; unit: string };
  supplier?: { name: string } | null;
  performedBy?: { firstName: string; lastName: string };
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  establishmentId: string;
  tableNumber?: string | null;
  orderType?: 'RESTAURANT' | 'LEISURE' | 'LOCATION';
  status: OrderStatus;
  totalAmount: number;
  paymentMethod?: PaymentMethod | null;
  invoiceId?: string | null;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  items: OrderItem[];
  createdBy?: { id: string; firstName: string; lastName: string };
  establishment?: { id: string; name: string };
  createdAt: string;
}

export interface OrderItem {
  id: string;
  articleId: string;
  quantity: number;
  unitPrice: number;
  article?: { id: string; name: string };
}

export interface ApprovalRequest {
  id: string;
  establishmentId: string;
  type: ApprovalType;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  targetId?: string | null;
  reason?: string | null;
  requestedBy?: { id: string; firstName: string; lastName: string; email: string };
  reviewedBy?: { id: string; firstName: string; lastName: string } | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface CleaningSession {
  id: string;
  establishmentId: string;
  roomId: string;
  cleanerId: string;
  status: CleaningStatus;
  clockInAt: string;
  clockOutAt?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  room?: { id: string; number: string; floor?: number | null };
  cleaner?: { id: string; firstName: string; lastName: string };
}

export interface StockAlert {
  id: string;
  establishmentId: string;
  articleId: string;
  message: string;
  isResolved: boolean;
  resolvedAt?: string | null;
  article?: { id: string; name: string; sku?: string | null; currentStock: number; minimumStock: number };
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

// =============================================================================
// Channel Sync
// =============================================================================

export interface ChannelConnection {
  id: string;
  roomId: string;
  channel: BookingSource;
  exportToken: string;
  importUrl?: string | null;
  isActive: boolean;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  syncIntervalMin: number;
  room?: { id: string; number: string; type: RoomType; establishment?: { name: string } };
  createdAt: string;
}

export interface ChannelSyncLog {
  id: string;
  connectionId: string;
  direction: string;
  eventsFound: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsCancelled: number;
  status: string;
  errorMessage?: string | null;
  durationMs?: number | null;
  createdAt: string;
}
