'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, StatCard, StatusBadge, LoadingPage, Modal } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuthStore';
import {
  BedDouble, CalendarCheck, Receipt, Package, AlertTriangle, UtensilsCrossed,
  ChefHat, SprayCan, CheckCircle2, ClipboardList, TrendingUp, DollarSign,
  ArrowRightLeft, Clock, LayoutGrid, Users, Eye, Settings2, GripVertical,
  ChevronUp, ChevronDown, Key,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import type { EstablishmentRole } from '@/types';

// =============================================================================
// WIDGET REGISTRY — all available widgets
// =============================================================================

type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

interface WidgetDef {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  roles: string[]; // roles that see this widget by default
  defaultSize: WidgetSize;
  category: string;
}

const ALL_WIDGETS: WidgetDef[] = [
  // — Rooms & Reservations —
  { id: 'rooms_occupancy', label: 'Taux d\'occupation', description: 'Chambres disponibles, occupées, en maintenance', icon: BedDouble, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER'], defaultSize: 'md', category: 'Hébergement' },
  { id: 'rooms_grid', label: 'Grille des chambres', description: 'Vue visuelle du statut de chaque chambre', icon: LayoutGrid, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER'], defaultSize: 'full', category: 'Hébergement' },
  { id: 'recent_reservations', label: 'Dernières réservations', description: '5 dernières réservations', icon: CalendarCheck, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER'], defaultSize: 'md', category: 'Hébergement' },

  // — Orders —
  { id: 'orders_today', label: 'Commandes du jour', description: 'Nombre de commandes aujourd\'hui, cette semaine, ce mois', icon: UtensilsCrossed, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS', 'COOK'], defaultSize: 'full', category: 'Commandes' },
  { id: 'my_orders', label: 'Mes commandes', description: 'Vos commandes personnelles (jour, semaine, mois)', icon: ClipboardList, roles: ['SERVER', 'POS', 'MAITRE_HOTEL'], defaultSize: 'full', category: 'Commandes' },
  { id: 'orders_pending', label: 'Commandes en attente', description: 'Commandes en attente et prêtes à servir', icon: Clock, roles: ['MAITRE_HOTEL', 'COOK', 'SERVER', 'POS'], defaultSize: 'md', category: 'Commandes' },
  { id: 'server_performance', label: 'Performance serveurs', description: 'Commandes et revenus par serveur', icon: Users, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL'], defaultSize: 'full', category: 'Commandes' },

  // — Finance —
  { id: 'recent_invoices', label: 'Dernières factures', description: '5 dernières factures avec statut', icon: Receipt, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER'], defaultSize: 'md', category: 'Finances' },
  { id: 'invoices_pending', label: 'Factures impayées', description: 'Nombre de factures en attente de paiement', icon: Receipt, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'POS'], defaultSize: 'sm', category: 'Finances' },
  { id: 'revenue_today', label: 'Revenu du jour', description: 'Chiffre d\'affaires total aujourd\'hui', icon: DollarSign, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MAITRE_HOTEL'], defaultSize: 'sm', category: 'Finances' },

  // — Stock —
  { id: 'stock_alerts', label: 'Alertes stock bas', description: 'Articles sous le seuil minimum', icon: AlertTriangle, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER'], defaultSize: 'full', category: 'Stock' },
  { id: 'stock_levels_chart', label: 'Niveaux de stock (graphique)', description: 'Graphique des niveaux de stock', icon: Package, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER'], defaultSize: 'md', category: 'Stock' },

  // — Operations —
  { id: 'cleaning_status', label: 'Nettoyage', description: 'Chambres à nettoyer, en cours, terminées', icon: SprayCan, roles: ['CLEANER', 'MANAGER'], defaultSize: 'full', category: 'Opérations' },
  { id: 'pending_approvals', label: 'Approbations en attente', description: 'Nombre de demandes à valider', icon: ClipboardList, roles: ['SUPERADMIN', 'OWNER', 'DAF'], defaultSize: 'full', category: 'Opérations' },

  // — Charts —
  { id: 'chart_occupancy', label: 'Occupation (graphique)', description: 'Camembert occupation des chambres', icon: BedDouble, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER'], defaultSize: 'md', category: 'Graphiques' },
  { id: 'chart_orders_week', label: 'Commandes de la semaine', description: 'Graphique des commandes par jour', icon: UtensilsCrossed, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL'], defaultSize: 'md', category: 'Graphiques' },
  { id: 'chart_servers', label: 'Commandes par serveur', description: 'Graphique des commandes par serveur', icon: Users, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL'], defaultSize: 'md', category: 'Graphiques' },

  // — Quick access —
  { id: 'quick_links', label: 'Accès rapide', description: 'Liens rapides vers les pages principales', icon: LayoutGrid, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS', 'COOK', 'CLEANER'], defaultSize: 'full', category: 'Général' },
];

interface WidgetConfig {
  id: string;
  enabled: boolean;
  order: number;
  size: WidgetSize;
}

function getDefaultWidgets(role: string | null): WidgetConfig[] {
  const effectiveRole = role || 'SUPERADMIN';
  return ALL_WIDGETS
    .filter(w => w.roles.includes(effectiveRole))
    .map((w, i) => ({ id: w.id, enabled: true, order: i, size: w.defaultSize }));
}

// =============================================================================
// Data hooks
// =============================================================================

function useRoomsStats() {
  return useQuery({ queryKey: ['rooms-stats'], queryFn: () => apiGet<any>('/rooms?limit=100') });
}

function useRecentReservations() {
  return useQuery({ queryKey: ['reservations-recent'], queryFn: () => apiGet<any>('/reservations?limit=5&sortBy=createdAt&sortOrder=desc') });
}

function useLowStock() {
  return useQuery({ queryKey: ['low-stock'], queryFn: () => apiGet<any>('/articles/low-stock') });
}

function useRecentInvoices() {
  return useQuery({ queryKey: ['invoices-recent'], queryFn: () => apiGet<any>('/invoices?limit=5&sortBy=createdAt&sortOrder=desc') });
}

function useOrderStats(establishmentId: string | null, userId?: string) {
  return useQuery({
    queryKey: ['order-stats', establishmentId, userId],
    queryFn: () => {
      const url = userId ? `/orders/stats/${establishmentId}?userId=${userId}` : `/orders/stats/${establishmentId}`;
      return apiGet<any>(url);
    },
    enabled: !!establishmentId,
  });
}

function useCleaningActive(establishmentId: string | null) {
  return useQuery({ queryKey: ['cleaning-active', establishmentId], queryFn: () => apiGet<any>(`/cleaning/active/${establishmentId}`), enabled: !!establishmentId });
}

function useAllOrders(establishmentId: string | null) {
  return useQuery({
    queryKey: ['all-orders-dashboard', establishmentId],
    queryFn: () => apiGet<any>(`/orders?limit=500${establishmentId ? `&establishmentId=${establishmentId}` : ''}`),
    enabled: !!establishmentId,
    refetchInterval: 30000,
  });
}

function usePendingApprovals(establishmentId: string | null) {
  return useQuery({
    queryKey: ['pending-approvals-count', establishmentId],
    queryFn: () => apiGet<any>(`/approvals/pending-count/${establishmentId}`),
    enabled: !!establishmentId,
    refetchInterval: 30000,
  });
}

function useDashboardConfig(establishmentId: string | null) {
  return useQuery({
    queryKey: ['dashboard-config', establishmentId],
    queryFn: () => apiGet<any>(`/dashboard-config${establishmentId ? `?establishmentId=${establishmentId}` : ''}`),
  });
}

// =============================================================================
// Chart palette
// =============================================================================

const COLORS = {
  primary: '#B85042', accent: '#D4A857', sage: '#7A9E88',
  wood: '#9C8B7E', woodDark: '#6B5B4E', primaryLight: '#D4735E', sageLight: '#A7BEAE',
};

// =============================================================================
// WIDGET COMPONENTS
// =============================================================================

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-accent p-5">
      <h4 className="mb-3 font-display text-sm font-bold text-wood-700">{title}</h4>
      {children}
    </div>
  );
}

// --- Rooms Occupancy Widget ---
function WidgetRoomsOccupancy() {
  const { data: rooms } = useRoomsStats();
  const roomsData = rooms?.data || [];
  const available = roomsData.filter((r: any) => r.status === 'AVAILABLE').length;
  const occupied = roomsData.filter((r: any) => r.status === 'OCCUPIED').length;
  const totalRooms = roomsData.length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
  const maintenance = roomsData.filter((r: any) => r.status === 'MAINTENANCE').length;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard title="Chambres disponibles" value={`${available} / ${totalRooms}`} subtitle={`${occupancyRate}% d'occupation`} icon={BedDouble} color="sage" />
      <StatCard title="Réservations actives" value={roomsData.filter((r: any) => r.status === 'OCCUPIED').length} icon={CalendarCheck} color="accent" />
      <StatCard title="Chambres occupées" value={occupied} icon={BedDouble} color="primary" />
      <StatCard title="En maintenance" value={maintenance} icon={BedDouble} color="amber" />
    </div>
  );
}

// --- Rooms Grid Widget ---
function WidgetRoomsGrid() {
  const { data: rooms } = useRoomsStats();
  const roomsData = rooms?.data || [];

  const statusColor = (s: string) =>
    s === 'AVAILABLE' ? 'bg-sage-100 text-sage-700' :
    s === 'OCCUPIED' ? 'bg-primary-100 text-primary-700' :
    s === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' :
    s === 'CLEANING' ? 'bg-blue-100 text-blue-700' :
    'bg-wood-100 text-wood-600';

  const statusLabel = (s: string) =>
    s === 'AVAILABLE' ? 'Libre' : s === 'OCCUPIED' ? 'Occupée' : s === 'MAINTENANCE' ? 'Maintenance' :
    s === 'CLEANING' ? 'Nettoyage' : s === 'OUT_OF_ORDER' ? 'Hors service' : s;

  if (roomsData.length === 0) return <p className="text-sm text-wood-400">Aucune chambre configurée</p>;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
      {roomsData.map((r: any) => (
        <div key={r.id} className={`rounded-lg px-2 py-2 text-center text-xs font-bold ${statusColor(r.status)}`} title={`${r.number} — ${statusLabel(r.status)}`}>
          <div className="text-sm">{r.number}</div>
          <div className="text-[10px] font-medium opacity-80">{statusLabel(r.status)}</div>
        </div>
      ))}
    </div>
  );
}

// --- Recent Reservations Widget ---
function WidgetRecentReservations() {
  const { data: reservations } = useRecentReservations();
  const list = reservations?.data || [];

  return (
    <div className="card-accent">
      <div className="flex items-center justify-between border-b border-wood-100 px-5 py-4">
        <h3 className="font-display font-bold text-wood-800">Dernières réservations</h3>
        <Link href="/dashboard/reservations" className="text-sm text-primary-500 hover:text-primary-600 font-semibold">Voir tout</Link>
      </div>
      <div className="divide-y divide-wood-50">
        {list.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-wood-400">Aucune réservation</p>
        ) : list.map((res: any) => (
          <Link key={res.id} href="/dashboard/reservations" className="flex items-center justify-between px-5 py-3.5 hover:bg-accent-50/30 transition-colors">
            <div>
              <p className="text-sm font-semibold text-wood-800">{res.guestName}</p>
              <p className="text-xs text-wood-500">Chambre {res.room?.number} — {formatDate(res.checkIn)} &rarr; {formatDate(res.checkOut)}</p>
            </div>
            <StatusBadge status={res.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// --- Orders Today Widget ---
function WidgetOrdersToday({ establishmentId }: { establishmentId: string | null }) {
  const { data: orderStats } = useOrderStats(establishmentId);
  const stats = orderStats?.data || {};

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <StatCard title="Commandes aujourd'hui" value={stats.today ?? '—'} icon={UtensilsCrossed} color="accent" />
      <StatCard title="Cette semaine" value={stats.thisWeek ?? '—'} icon={ClipboardList} color="primary" />
      <StatCard title="Ce mois" value={stats.thisMonth ?? '—'} icon={TrendingUp} color="sage" />
    </div>
  );
}

// --- My Orders Widget ---
function WidgetMyOrders({ establishmentId, userId }: { establishmentId: string | null; userId?: string }) {
  const { data: myOrderStats } = useOrderStats(establishmentId, userId);
  const myStats = myOrderStats?.data || {};

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <StatCard title="Mes commandes aujourd'hui" value={myStats.today ?? '—'} icon={UtensilsCrossed} color="accent" />
      <StatCard title="Ma semaine" value={myStats.thisWeek ?? '—'} icon={ClipboardList} color="primary" />
      <StatCard title="Mon mois" value={myStats.thisMonth ?? '—'} icon={TrendingUp} color="sage" />
    </div>
  );
}

// --- Orders Pending Widget ---
function WidgetOrdersPending({ establishmentId }: { establishmentId: string | null }) {
  const { data: allOrdersData } = useAllOrders(establishmentId);
  const allOrders = allOrdersData?.data || [];
  const pending = allOrders.filter((o: any) => o.status === 'PENDING').length;
  const preparing = allOrders.filter((o: any) => o.status === 'IN_PROGRESS').length;
  const ready = allOrders.filter((o: any) => o.status === 'READY').length;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <StatCard title="En attente" value={pending} icon={Clock} color="amber" />
      <StatCard title="En préparation" value={preparing} icon={ChefHat} color="primary" />
      <StatCard title="Prêtes à servir" value={ready} icon={CheckCircle2} color="sage" />
    </div>
  );
}

// --- Server Performance Widget ---
function WidgetServerPerformance({ establishmentId }: { establishmentId: string | null }) {
  const { data: allOrdersData } = useAllOrders(establishmentId);
  const allOrders = allOrdersData?.data || [];

  const byServer: Record<string, { name: string; orders: any[] }> = {};
  allOrders.forEach((order: any) => {
    const serverId = order.createdBy?.id || 'unknown';
    if (!byServer[serverId]) {
      const name = order.createdBy ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim() : 'Inconnu';
      byServer[serverId] = { name, orders: [] };
    }
    byServer[serverId].orders.push(order);
  });

  const breakdown = Object.values(byServer)
    .map(s => ({
      name: s.name, total: s.orders.length,
      revenue: s.orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0),
      pending: s.orders.filter((o: any) => o.status === 'PENDING').length,
      ready: s.orders.filter((o: any) => o.status === 'READY').length,
      served: s.orders.filter((o: any) => o.status === 'SERVED').length,
    }))
    .sort((a, b) => b.total - a.total);

  if (breakdown.length === 0) return <p className="text-sm text-wood-400 py-4">Aucune commande aujourd&apos;hui</p>;

  return (
    <div className="card-accent overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-wood-100 bg-wood-50/50">
              <th className="px-4 py-3 text-left font-semibold text-wood-600">Serveur</th>
              <th className="px-4 py-3 text-center font-semibold text-wood-600">Commandes</th>
              <th className="px-4 py-3 text-center font-semibold text-wood-600">Revenu</th>
              <th className="px-4 py-3 text-center font-semibold text-wood-600 hidden sm:table-cell">En attente</th>
              <th className="px-4 py-3 text-center font-semibold text-wood-600 hidden sm:table-cell">Prêtes</th>
              <th className="px-4 py-3 text-center font-semibold text-wood-600 hidden sm:table-cell">Servies</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((server, i) => (
              <tr key={i} className="border-b border-wood-50 hover:bg-accent-50/30 transition-colors">
                <td className="px-4 py-3 font-semibold text-wood-800">{server.name}</td>
                <td className="px-4 py-3 text-center font-bold text-wood-700">{server.total}</td>
                <td className="px-4 py-3 text-center text-wood-700">{formatCurrency(server.revenue)}</td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {server.pending > 0 ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{server.pending}</span> : <span className="text-wood-300">0</span>}
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {server.ready > 0 ? <span className="inline-flex items-center rounded-full bg-sage-100 px-2 py-0.5 text-xs font-bold text-sage-700">{server.ready}</span> : <span className="text-wood-300">0</span>}
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell"><span className="text-wood-500">{server.served}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Recent Invoices Widget ---
function WidgetRecentInvoices() {
  const { data: invoices } = useRecentInvoices();
  const list = invoices?.data || [];

  return (
    <div className="card-accent">
      <div className="flex items-center justify-between border-b border-wood-100 px-5 py-4">
        <h3 className="font-display font-bold text-wood-800">Dernières factures</h3>
        <Link href="/dashboard/invoices" className="text-sm text-primary-500 hover:text-primary-600 font-semibold">Voir tout</Link>
      </div>
      <div className="divide-y divide-wood-50">
        {list.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-wood-400">Aucune facture</p>
        ) : list.map((inv: any) => (
          <div key={inv.id} className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-wood-800">{inv.invoiceNumber}</p>
              <p className="text-xs text-wood-500">{inv.reservation?.guestName || 'Client direct'} — {formatDate(inv.createdAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-wood-800">{formatCurrency(inv.totalAmount)}</p>
              <StatusBadge status={inv.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Invoices Pending Widget ---
function WidgetInvoicesPending() {
  const { data: invoices } = useRecentInvoices();
  const list = invoices?.data || [];
  const pendingCount = list.filter((i: any) => ['ISSUED', 'OVERDUE'].includes(i.status)).length;

  return <StatCard title="Factures en attente" value={pendingCount} icon={Receipt} color="amber" />;
}

// --- Revenue Today Widget ---
function WidgetRevenueToday({ establishmentId }: { establishmentId: string | null }) {
  const { data: allOrdersData } = useAllOrders(establishmentId);
  const allOrders = allOrdersData?.data || [];
  const totalRevenue = allOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

  return <StatCard title="Revenu du jour" value={formatCurrency(totalRevenue)} icon={DollarSign} color="sage" />;
}

// --- Stock Alerts Widget ---
function WidgetStockAlerts() {
  const { data: lowStock } = useLowStock();
  const items = (lowStock as any)?.data || [];

  if (items.length === 0) {
    return <StatCard title="Alertes stock" value={0} subtitle="Tout est OK" icon={Package} color="sage" />;
  }

  return (
    <div className="space-y-4">
      <StatCard title="Alertes stock" value={items.length} subtitle="Articles sous le seuil" icon={AlertTriangle} color="red" />
      <div className="card border-accent-300 bg-accent-50/30">
        <div className="grid gap-3 p-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item: any) => (
            <div key={item.id} className="rounded-lg bg-white border border-accent-200 p-3">
              <p className="text-sm font-semibold text-wood-800">{item.name}</p>
              <p className="text-xs text-wood-500 font-mono">{item.sku}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-accent-800">Stock: <strong>{item.current_stock || item.currentStock}</strong> / Min: {item.minimum_stock || item.minimumStock}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Cleaning Status Widget ---
function WidgetCleaningStatus({ establishmentId }: { establishmentId: string | null }) {
  const { data: rooms } = useRoomsStats();
  const { data: cleaningActive } = useCleaningActive(establishmentId);
  const roomsData = rooms?.data || [];
  const roomsToCl = roomsData.filter((r: any) => r.status === 'CLEANING').length;
  const activeSessions = cleaningActive?.data || [];
  const inProgress = activeSessions.filter((s: any) => s.status === 'IN_PROGRESS').length;
  const completed = activeSessions.filter((s: any) => s.status === 'COMPLETED').length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard title="Chambres à nettoyer" value={roomsToCl} icon={SprayCan} color={roomsToCl > 0 ? 'accent' : 'sage'} />
        <StatCard title="Nettoyages en cours" value={inProgress} icon={SprayCan} color="primary" />
        <StatCard title="Nettoyées aujourd'hui" value={completed} icon={CheckCircle2} color="sage" />
      </div>
      <Link href="/dashboard/cleaning" className="btn-primary inline-flex items-center gap-2">
        <SprayCan className="h-4 w-4" /> Voir les chambres à nettoyer
      </Link>
    </div>
  );
}

// --- Pending Approvals Widget ---
function WidgetPendingApprovals({ establishmentId }: { establishmentId: string | null }) {
  const { data: pendingApprovals } = usePendingApprovals(establishmentId);
  const count = pendingApprovals?.data?.count || 0;

  if (count === 0) return null;

  return (
    <Link href="/dashboard/approvals" className="block">
      <div className="card border-2 border-accent-400 bg-accent-50 p-5 hover:bg-accent-100 transition-colors cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-xl bg-accent-200 p-3"><ClipboardList className="h-6 w-6 text-accent-800" /></div>
              <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">{count}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-accent-900">{count} approbation{count > 1 ? 's' : ''} en attente</p>
              <p className="text-sm text-accent-700">Cliquez pour traiter les demandes</p>
            </div>
          </div>
          <div className="text-accent-600 font-bold text-sm">Voir &rarr;</div>
        </div>
      </div>
    </Link>
  );
}

// --- Stock Levels Chart Widget ---
function WidgetStockLevelsChart() {
  const { data: lowStock } = useLowStock();
  const items = (lowStock as any)?.data || [];
  const chartData = items.slice(0, 8).map((item: any) => ({
    name: item.name?.length > 12 ? item.name.substring(0, 10) + '..' : item.name,
    stock: item.current_stock || item.currentStock || 0,
    min: item.minimum_stock || item.minimumStock || 0,
  }));

  if (chartData.length === 0) return <p className="text-sm text-wood-400 py-4">Aucune donnée de stock</p>;

  return (
    <ChartCard title="Niveaux de stock">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#9C8B7E' }} width={80} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="stock" name="Stock actuel" fill={COLORS.sage} radius={[0, 4, 4, 0]} />
          <Bar dataKey="min" name="Stock minimum" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- Room Occupancy Chart Widget ---
function WidgetChartOccupancy() {
  const { data: rooms } = useRoomsStats();
  const roomsData = rooms?.data || [];
  const data = [
    { name: 'Disponibles', value: roomsData.filter((r: any) => r.status === 'AVAILABLE').length },
    { name: 'Occupées', value: roomsData.filter((r: any) => r.status === 'OCCUPIED').length },
    { name: 'Maintenance', value: roomsData.filter((r: any) => r.status === 'MAINTENANCE').length },
  ];
  const pieColors = [COLORS.sage, COLORS.accent, COLORS.primary];

  return (
    <ChartCard title="Occupation des chambres">
      <ResponsiveContainer width="100%" height={250}>
        <RechartsPieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
            {data.map((_, index) => <Cell key={`cell-${index}`} fill={pieColors[index]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- Orders Week Chart Widget ---
function WidgetChartOrdersWeek() {
  const { data: allOrdersData } = useAllOrders(useAuthStore.getState().currentEstablishmentId);
  const allOrders = allOrdersData?.data || [];

  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const counts: Record<string, number> = {};
  days.forEach(d => { counts[d] = 0; });
  allOrders.forEach((o: any) => {
    const d = new Date(o.createdAt);
    counts[days[d.getDay()]] = (counts[days[d.getDay()]] || 0) + 1;
  });
  const chartData = days.map(d => ({ jour: d, commandes: counts[d] || 0 }));

  return (
    <ChartCard title="Commandes par jour">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
          <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Bar dataKey="commandes" name="Commandes" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- Orders by Server Chart Widget ---
function WidgetChartServers() {
  const { data: allOrdersData } = useAllOrders(useAuthStore.getState().currentEstablishmentId);
  const allOrders = allOrdersData?.data || [];

  const byServer: Record<string, { name: string; count: number }> = {};
  allOrders.forEach((o: any) => {
    const id = o.createdBy?.id || 'unknown';
    if (!byServer[id]) byServer[id] = { name: o.createdBy ? `${o.createdBy.firstName || ''} ${o.createdBy.lastName || ''}`.trim() : 'Inconnu', count: 0 };
    byServer[id].count++;
  });
  const chartData = Object.values(byServer).sort((a, b) => b.count - a.count).slice(0, 8);

  if (chartData.length === 0) return <p className="text-sm text-wood-400 py-4">Aucune donnée</p>;

  return (
    <ChartCard title="Commandes par serveur">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Bar dataKey="count" name="Commandes" fill={COLORS.sage} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// --- Quick Links Widget ---
function WidgetQuickLinks({ role }: { role: string | null }) {
  const links: Array<{ href: string; label: string; icon: React.ElementType; roles: string[] }> = [
    { href: '/dashboard/orders', label: 'Commandes', icon: UtensilsCrossed, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS', 'COOK'] },
    { href: '/dashboard/reservations', label: 'Réservations', icon: CalendarCheck, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER'] },
    { href: '/dashboard/invoices', label: 'Factures', icon: Receipt, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'POS'] },
    { href: '/dashboard/reports', label: 'Rapports', icon: TrendingUp, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL'] },
    { href: '/dashboard/stock', label: 'Articles & Menu', icon: Package, roles: ['SUPERADMIN', 'OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL'] },
    { href: '/dashboard/cleaning', label: 'Ménage', icon: SprayCan, roles: ['CLEANER', 'MANAGER'] },
    { href: '/dashboard/approvals', label: 'Approbations', icon: ClipboardList, roles: ['SUPERADMIN', 'OWNER', 'DAF'] },
  ];

  const effectiveRole = role || 'SUPERADMIN';
  const visible = links.filter(l => l.roles.includes(effectiveRole));

  return (
    <div className="card-accent p-5">
      <h3 className="font-display font-bold text-wood-800 mb-3">Accès rapide</h3>
      <div className="flex gap-3 flex-wrap">
        {visible.map(l => (
          <Link key={l.href} href={l.href} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <l.icon className="h-4 w-4" /> {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// WIDGET RENDERER — maps widget ID to component
// =============================================================================

function RenderWidget({ id, establishmentId, userId, role }: { id: string; establishmentId: string | null; userId?: string; role: string | null }) {
  switch (id) {
    case 'rooms_occupancy': return <WidgetRoomsOccupancy />;
    case 'rooms_grid': return <WidgetRoomsGrid />;
    case 'recent_reservations': return <WidgetRecentReservations />;
    case 'orders_today': return <WidgetOrdersToday establishmentId={establishmentId} />;
    case 'my_orders': return <WidgetMyOrders establishmentId={establishmentId} userId={userId} />;
    case 'orders_pending': return <WidgetOrdersPending establishmentId={establishmentId} />;
    case 'server_performance': return <WidgetServerPerformance establishmentId={establishmentId} />;
    case 'recent_invoices': return <WidgetRecentInvoices />;
    case 'invoices_pending': return <WidgetInvoicesPending />;
    case 'revenue_today': return <WidgetRevenueToday establishmentId={establishmentId} />;
    case 'stock_alerts': return <WidgetStockAlerts />;
    case 'stock_levels_chart': return <WidgetStockLevelsChart />;
    case 'cleaning_status': return <WidgetCleaningStatus establishmentId={establishmentId} />;
    case 'pending_approvals': return <WidgetPendingApprovals establishmentId={establishmentId} />;
    case 'chart_occupancy': return <WidgetChartOccupancy />;
    case 'chart_orders_week': return <WidgetChartOrdersWeek />;
    case 'chart_servers': return <WidgetChartServers />;
    case 'quick_links': return <WidgetQuickLinks role={role} />;
    default: return <p className="text-sm text-wood-400">Widget inconnu: {id}</p>;
  }
}

// =============================================================================
// WIDGET CONFIGURATOR MODAL
// =============================================================================

function WidgetConfigurator({ widgets, onChange, onClose, role }: {
  widgets: WidgetConfig[];
  onChange: (w: WidgetConfig[]) => void;
  onClose: () => void;
  role: string | null;
}) {
  const [local, setLocal] = useState<WidgetConfig[]>(widgets);
  const effectiveRole = role || 'SUPERADMIN';

  // All available widgets for this role
  const available = ALL_WIDGETS.filter(w => w.roles.includes(effectiveRole));
  // Group by category
  const categories = Array.from(new Set(available.map(w => w.category)));

  const toggle = (id: string) => {
    setLocal(prev => {
      const existing = prev.find(w => w.id === id);
      if (existing) {
        return prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
      }
      const def = ALL_WIDGETS.find(w => w.id === id)!;
      return [...prev, { id, enabled: true, order: prev.length, size: def.defaultSize }];
    });
  };

  const moveUp = (id: string) => {
    setLocal(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(w => w.id === id);
      if (idx <= 0) return prev;
      const newOrder = [...sorted];
      [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
      return newOrder.map((w, i) => ({ ...w, order: i }));
    });
  };

  const moveDown = (id: string) => {
    setLocal(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(w => w.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const newOrder = [...sorted];
      [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      return newOrder.map((w, i) => ({ ...w, order: i }));
    });
  };

  const save = () => {
    onChange(local);
    onClose();
  };

  const enabledWidgets = local.filter(w => w.enabled).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto">
      {/* Enabled widgets — reorder */}
      <div>
        <h4 className="font-display font-bold text-wood-800 mb-2">Widgets actifs ({enabledWidgets.length})</h4>
        <div className="space-y-1">
          {enabledWidgets.map(wc => {
            const def = ALL_WIDGETS.find(w => w.id === wc.id);
            if (!def) return null;
            return (
              <div key={wc.id} className="flex items-center gap-2 rounded-lg border border-wood-200 bg-white px-3 py-2">
                <GripVertical className="h-4 w-4 text-wood-400 shrink-0" />
                <def.icon className="h-4 w-4 text-primary-500 shrink-0" />
                <span className="flex-1 text-sm font-medium text-wood-800">{def.label}</span>
                <button onClick={() => moveUp(wc.id)} className="p-1 hover:bg-wood-100 rounded" title="Monter"><ChevronUp className="h-4 w-4 text-wood-500" /></button>
                <button onClick={() => moveDown(wc.id)} className="p-1 hover:bg-wood-100 rounded" title="Descendre"><ChevronDown className="h-4 w-4 text-wood-500" /></button>
                <button onClick={() => toggle(wc.id)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2">Retirer</button>
              </div>
            );
          })}
          {enabledWidgets.length === 0 && <p className="text-sm text-wood-400 py-2">Aucun widget actif</p>}
        </div>
      </div>

      {/* Available widgets by category */}
      {categories.map(cat => {
        const catWidgets = available.filter(w => w.category === cat);
        const hasDisabled = catWidgets.some(w => {
          const cfg = local.find(c => c.id === w.id);
          return !cfg || !cfg.enabled;
        });
        if (!hasDisabled) return null;

        return (
          <div key={cat}>
            <h4 className="font-display font-bold text-wood-600 text-sm mb-2">{cat}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catWidgets.filter(w => {
                const cfg = local.find(c => c.id === w.id);
                return !cfg || !cfg.enabled;
              }).map(w => (
                <button key={w.id} onClick={() => toggle(w.id)} className="flex items-center gap-3 rounded-lg border border-dashed border-wood-300 px-3 py-2.5 text-left hover:bg-sage-50 transition-colors">
                  <w.icon className="h-4 w-4 text-wood-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-wood-700">{w.label}</p>
                    <p className="text-xs text-wood-400 truncate">{w.description}</p>
                  </div>
                  <span className="text-xs text-sage-600 font-medium shrink-0">+ Ajouter</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end gap-3 pt-4 border-t border-wood-100">
        <button onClick={onClose} className="btn-secondary">Annuler</button>
        <button onClick={save} className="btn-primary">Enregistrer</button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN DASHBOARD PAGE
// =============================================================================

export default function DashboardPage() {
  const { user, currentEstablishmentRole, currentEstablishmentId } = useAuthStore();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const role = isSuperAdmin && !currentEstablishmentRole ? 'SUPERADMIN' : (currentEstablishmentRole || 'SUPERADMIN');

  const [showConfig, setShowConfig] = useState(false);
  const { data: configData, isLoading: configLoading } = useDashboardConfig(currentEstablishmentId);

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => getDefaultWidgets(role));

  // Sync from API when config loads
  useEffect(() => {
    if (configData?.data?.widgets && Array.isArray(configData.data.widgets)) {
      setWidgets(configData.data.widgets);
    } else {
      setWidgets(getDefaultWidgets(role));
    }
  }, [configData, role]);

  const saveMutation = useMutation({
    mutationFn: (newWidgets: WidgetConfig[]) => apiPut('/dashboard-config', {
      establishmentId: currentEstablishmentId || '',
      widgets: newWidgets,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
    },
  });

  const handleSaveWidgets = useCallback((newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    saveMutation.mutate(newWidgets);
  }, [saveMutation]);

  const enabledWidgets = widgets
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  const sizeClass = (size: WidgetSize) => {
    switch (size) {
      case 'sm': return 'lg:col-span-1';
      case 'md': return 'lg:col-span-1';
      case 'lg': return 'lg:col-span-2';
      case 'full': return 'lg:col-span-2';
      default: return '';
    }
  };

  if (configLoading) return <LoadingPage />;

  const roleLabel: Record<string, string> = {
    SUPERADMIN: 'Super Administrateur',
    OWNER: 'Propriétaire',
    DAF: 'Direction Administrative et Financière',
    MANAGER: 'Manager',
    MAITRE_HOTEL: 'Maître d\'hôtel',
    SERVER: 'Serveur',
    POS: 'Point de vente',
    COOK: 'Cuisine',
    CLEANER: 'Ménage',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle={roleLabel[role] || 'Vue d\'ensemble'}
        action={
          <button onClick={() => setShowConfig(true)} className="btn-secondary inline-flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Personnaliser
          </button>
        }
      />
      <div className="divider-teranga" />

      {enabledWidgets.length === 0 ? (
        <div className="card p-12 text-center">
          <LayoutGrid className="h-12 w-12 text-wood-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-wood-600 mb-2">Aucun widget actif</p>
          <p className="text-sm text-wood-400 mb-4">Personnalisez votre tableau de bord en ajoutant des widgets</p>
          <button onClick={() => setShowConfig(true)} className="btn-primary">
            <Settings2 className="mr-2 h-4 w-4" /> Configurer les widgets
          </button>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {enabledWidgets.map(wc => {
            const def = ALL_WIDGETS.find(w => w.id === wc.id);
            if (!def) return null;
            return (
              <div key={wc.id} className={sizeClass(wc.size)}>
                <RenderWidget
                  id={wc.id}
                  establishmentId={currentEstablishmentId}
                  userId={user?.id}
                  role={role}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Widget configurator modal */}
      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="Personnaliser le tableau de bord" size="lg">
        <WidgetConfigurator
          widgets={widgets}
          onChange={handleSaveWidgets}
          onClose={() => setShowConfig(false)}
          role={role}
        />
      </Modal>
    </div>
  );
}
