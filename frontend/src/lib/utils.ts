import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelative(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return formatDate(date);
}

export const statusColors: Record<string, string> = {
  // Room status
  AVAILABLE: 'badge-success',
  OCCUPIED: 'badge-danger',
  MAINTENANCE: 'badge-warning',
  OUT_OF_ORDER: 'badge-neutral',
  CLEANING: 'badge-info',
  // Reservation status
  PENDING: 'badge-warning',
  CONFIRMED: 'badge-info',
  CHECKED_IN: 'badge-success',
  CHECKED_OUT: 'badge-neutral',
  CANCELLED: 'badge-danger',
  NO_SHOW: 'badge-danger',
  // Invoice status
  DRAFT: 'badge-neutral',
  ISSUED: 'badge-info',
  PAID: 'badge-success',
  PARTIALLY_PAID: 'badge-warning',
  OVERDUE: 'badge-danger',
  // User status
  ACTIVE: 'badge-success',
  PENDING_APPROVAL: 'badge-warning',
  LOCKED: 'badge-danger',
  ARCHIVED: 'badge-neutral',
  // Order status
  IN_PROGRESS: 'badge-info',
  READY: 'badge-success',
  SERVED: 'badge-neutral',
  // Approval status
  APPROVED: 'badge-success',
  REJECTED: 'badge-danger',
};

export const statusLabels: Record<string, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Occupée',
  MAINTENANCE: 'Maintenance',
  OUT_OF_ORDER: 'Hors service',
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  CHECKED_IN: 'Enregistré',
  CHECKED_OUT: 'Parti',
  CANCELLED: 'Annulée',
  NO_SHOW: 'No show',
  DRAFT: 'Brouillon',
  ISSUED: 'Émise',
  PAID: 'Payée',
  PARTIALLY_PAID: 'Paiement partiel',
  OVERDUE: 'En retard',
  ACTIVE: 'Actif',
  PENDING_APPROVAL: 'En attente',
  LOCKED: 'Verrouillé',
  ARCHIVED: 'Archivé',
  SINGLE: 'Simple',
  DOUBLE: 'Double',
  SUITE: 'Suite',
  FAMILY: 'Familiale',
  DELUXE: 'Deluxe',
  CLEANING: 'Nettoyage',
  IN_PROGRESS: 'En cours',
  READY: 'Prête',
  SERVED: 'Servie',
  APPROVED: 'Approuvée',
  REJECTED: 'Rejetée',
  COMPLETED: 'Terminé',
  // Tenant roles
  SUPERADMIN: 'Super Admin',
  EMPLOYEE: 'Employé',
  // Establishment roles
  DAF: 'DAF',
  MANAGER: 'Manager',
  MAITRE_HOTEL: 'Maître d\'hôtel',
  SERVER: 'Serveur',
  POS: 'Point de vente',
  COOK: 'Cuisinier',
  CLEANER: 'Ménage',
  CASH: 'Espèces',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  MOOV_MONEY: 'Moov Money',
  MIXX_BY_YAS: 'Mixx by Yas',
  DIRECT: 'Direct',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb',
  CHANNEL_MANAGER: 'Channel Manager',
  PHONE: 'Téléphone',
  WALK_IN: 'Walk-in',
  PURCHASE: 'Achat',
  SALE: 'Vente',
  ADJUSTMENT: 'Ajustement',
  TRANSFER: 'Transfert',
  WASTE: 'Perte',
  RETURN: 'Retour',
};
