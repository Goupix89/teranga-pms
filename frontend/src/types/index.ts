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

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'LOCKED' | 'ARCHIVED';
export type RoomType = 'SINGLE' | 'DOUBLE' | 'SUITE' | 'FAMILY' | 'DELUXE';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OUT_OF_ORDER';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'OTHER';
export type StockMovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'WASTE' | 'RETURN';
export type BookingSource = 'DIRECT' | 'BOOKING_COM' | 'EXPEDIA' | 'AIRBNB' | 'CHANNEL_MANAGER' | 'PHONE' | 'WALK_IN';

// =============================================================================
// Auth
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  tenantSlug: string;
}

export interface LoginResponse {
  accessToken: string;
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
  establishments?: Array<{ id: string; name: string }>;
}

export interface Establishment {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone?: string | null;
  email?: string | null;
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
  features: Record<string, unknown>;
  displayOrder: number;
}

export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID';

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
