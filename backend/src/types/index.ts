import { UserRole } from '@prisma/client';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
    }
  }
}

export interface AuthUser {
  id: string;
  tenantId: string;
  role: UserRole;
  establishmentIds?: string[];
}

export interface TokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Array<{ field: string; message: string }>;
}
