'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDate, statusLabels } from '@/lib/utils';
import { PageHeader, StatCard, StatusBadge, LoadingPage } from '@/components/ui';
import { BedDouble, CalendarCheck, Receipt, Package, AlertTriangle, TrendingUp, Users, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms-stats'],
    queryFn: () => apiGet<any>('/rooms?limit=100'),
  });

  const { data: reservations } = useQuery({
    queryKey: ['reservations-recent'],
    queryFn: () => apiGet<any>('/reservations?limit=5&sortBy=createdAt&sortOrder=desc'),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => apiGet<any>('/articles/low-stock'),
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices-recent'],
    queryFn: () => apiGet<any>('/invoices?limit=5&sortBy=createdAt&sortOrder=desc'),
  });

  const roomsData = rooms?.data || [];
  const available = roomsData.filter((r: any) => r.status === 'AVAILABLE').length;
  const occupied = roomsData.filter((r: any) => r.status === 'OCCUPIED').length;
  const totalRooms = roomsData.length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

  const recentReservations = reservations?.data || [];
  const recentInvoices = invoices?.data || [];
  const lowStockItems = (lowStock as any)?.data || [];

  if (roomsLoading) return <LoadingPage />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre établissement"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Chambres disponibles"
          value={`${available} / ${totalRooms}`}
          subtitle={`${occupancyRate}% d'occupation`}
          icon={BedDouble}
          color="primary"
        />
        <StatCard
          title="Réservations actives"
          value={reservations?.meta?.total || 0}
          icon={CalendarCheck}
          color="emerald"
        />
        <StatCard
          title="Factures en attente"
          value={recentInvoices.filter((i: any) => ['ISSUED', 'OVERDUE'].includes(i.status)).length}
          icon={Receipt}
          color="amber"
        />
        <StatCard
          title="Alertes stock"
          value={lowStockItems.length}
          subtitle={lowStockItems.length > 0 ? 'Articles sous le seuil' : 'Tout est OK'}
          icon={lowStockItems.length > 0 ? AlertTriangle : Package}
          color={lowStockItems.length > 0 ? 'red' : 'emerald'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Reservations */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="font-semibold text-gray-900">Dernières réservations</h3>
            <Link href="/dashboard/reservations" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentReservations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune réservation</p>
            ) : (
              recentReservations.map((res: any) => (
                <Link
                  key={res.id}
                  href={`/dashboard/reservations`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{res.guestName}</p>
                    <p className="text-xs text-gray-500">
                      Chambre {res.room?.number} — {formatDate(res.checkIn)} → {formatDate(res.checkOut)}
                    </p>
                  </div>
                  <StatusBadge status={res.status} />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="font-semibold text-gray-900">Dernières factures</h3>
            <Link href="/dashboard/invoices" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentInvoices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune facture</p>
            ) : (
              recentInvoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">
                      {inv.reservation?.guestName || 'Client direct'} — {formatDate(inv.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/30">
          <div className="flex items-center gap-3 border-b border-amber-100 px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Alertes de stock bas</h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.slice(0, 6).map((item: any) => (
              <div key={item.id} className="rounded-lg bg-white border border-amber-100 p-3">
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.sku}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-amber-700">
                    Stock: <strong>{item.current_stock || item.currentStock}</strong> / Min: {item.minimum_stock || item.minimumStock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
