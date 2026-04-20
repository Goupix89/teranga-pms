import { Request } from 'express';
import { PaginationParams, PaginatedResponse } from '../types';

/**
 * Extract pagination parameters from query string with sensible defaults.
 */
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 20));
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, sortBy, sortOrder };
}

/**
 * Build a paginated response from data + total count.
 */
export function paginate<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);

  return {
    data,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

/**
 * Convert Prisma pagination params to skip/take
 */
export function toSkipTake(params: PaginationParams) {
  return {
    skip: (params.page - 1) * params.limit,
    take: params.limit,
    orderBy: { [params.sortBy || 'createdAt']: params.sortOrder || 'desc' },
  };
}

/**
 * Validate a user-supplied operation date (payment date, stock movement, invoice issue).
 *
 * Rules:
 *   - must be a parseable date
 *   - cannot be in the future (>1h tolerance for client clock skew)
 *   - default cap: 15 days in the past
 *   - beyond the cap: only OWNER/DAF/MANAGER in the target establishment, or SUPERADMIN
 *
 * Returns the parsed Date on success, or throws ValidationError with a useful message.
 * Caller is responsible for deciding if the field is required — pass undefined/null
 * through to skip validation (defaults handled by DB).
 */
export function validateOperationDate(
  raw: string | Date | undefined | null,
  opts: {
    userRole?: string;
    establishmentRole?: string | null;
    capDays?: number;
    fieldLabel?: string;
  } = {}
): Date | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Date invalide pour ${opts.fieldLabel ?? 'l\'opération'}`);
  }
  const now = new Date();
  if (date.getTime() - now.getTime() > 60 * 60 * 1000) {
    throw new Error(`La date d'opération ne peut pas être dans le futur`);
  }
  const capDays = opts.capDays ?? 15;
  const capMs = capDays * 24 * 60 * 60 * 1000;
  const ageMs = now.getTime() - date.getTime();
  if (ageMs > capMs) {
    const isSupervisor =
      opts.userRole === 'SUPERADMIN' ||
      opts.establishmentRole === 'OWNER' ||
      opts.establishmentRole === 'DAF' ||
      opts.establishmentRole === 'MANAGER';
    if (!isSupervisor) {
      throw new Error(
        `Rétrodatage au-delà de ${capDays} jours réservé aux superviseurs (OWNER, DAF, MANAGER)`
      );
    }
  }
  return date;
}

/**
 * Generate a sequential invoice number for a tenant.
 * Format: INV-YYYYMM-NNNN
 */
export function generateInvoiceNumber(sequenceNumber: number): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `INV-${yearMonth}-${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Calculate number of nights between two dates.
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format a date as iCal DATE (YYYYMMDD)
 */
export function formatICalDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Format a date as iCal DATETIME (YYYYMMDDTHHmmssZ)
 */
export function formatICalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape special characters for iCalendar format per RFC 5545
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
