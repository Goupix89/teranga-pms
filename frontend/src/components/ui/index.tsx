'use client';

import { cn, statusColors, statusLabels, formatCurrency } from '@/lib/utils';
import { ChevronLeft, ChevronRight, X, Loader2, Search } from 'lucide-react';
import { ReactNode, useEffect, useRef } from 'react';

// =============================================================================
// Status Badge
// =============================================================================
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(statusColors[status] || 'badge-neutral')}>
      {statusLabels[status] || status}
    </span>
  );
}

// =============================================================================
// Stat Card (Dashboard)
// =============================================================================
export function StatCard({
  title, value, subtitle, icon: Icon, trend, color = 'primary',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?: 'primary' | 'emerald' | 'amber' | 'red';
}) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Page Header
// =============================================================================
export function PageHeader({
  title, subtitle, action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="mt-3 sm:mt-0">{action}</div>}
    </div>
  );
}

// =============================================================================
// Search Input
// =============================================================================
export function SearchInput({
  value, onChange, placeholder = 'Rechercher...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

// =============================================================================
// Pagination
// =============================================================================
export function Pagination({
  page, totalPages, total, onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
      <p className="text-sm text-gray-500">
        {total} résultat{total > 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-ghost p-2 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 text-sm text-gray-700">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-ghost p-2 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Modal
// =============================================================================
export function Modal({
  open, onClose, title, children, size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={cn('w-full rounded-2xl bg-white shadow-2xl', sizeMap[size])}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// =============================================================================
// Loading Spinner
// =============================================================================
export function LoadingSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-6 w-6 animate-spin text-primary-600', className)} />;
}

export function LoadingPage() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <LoadingSpinner className="mx-auto h-8 w-8" />
        <p className="mt-3 text-sm text-gray-500">Chargement...</p>
      </div>
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================
export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-gray-100 p-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// =============================================================================
// Confirm Dialog
// =============================================================================
export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirmer', danger = false, loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary" disabled={loading}>
          Annuler
        </button>
        <button
          onClick={onConfirm}
          className={cn(danger ? 'btn-danger' : 'btn-primary')}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
