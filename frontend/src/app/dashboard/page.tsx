'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, StatCard, StatusBadge, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuthStore';
import {
  BedDouble,
  CalendarCheck,
  Receipt,
  Package,
  AlertTriangle,
  UtensilsCrossed,
  ChefHat,
  SprayCan,
  CheckCircle2,
  ClipboardList,
  TrendingUp,
  DollarSign,
  ArrowRightLeft,
  Clock,
  LayoutGrid,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import type { EstablishmentRole } from '@/types';

// =============================================================================
// Data hooks
// =============================================================================

function useRoomsStats() {
  return useQuery({
    queryKey: ['rooms-stats'],
    queryFn: () => apiGet<any>('/rooms?limit=100'),
  });
}

function useRecentReservations() {
  return useQuery({
    queryKey: ['reservations-recent'],
    queryFn: () => apiGet<any>('/reservations?limit=5&sortBy=createdAt&sortOrder=desc'),
  });
}

function useLowStock() {
  return useQuery({
    queryKey: ['low-stock'],
    queryFn: () => apiGet<any>('/articles/low-stock'),
  });
}

function useRecentInvoices() {
  return useQuery({
    queryKey: ['invoices-recent'],
    queryFn: () => apiGet<any>('/invoices?limit=5&sortBy=createdAt&sortOrder=desc'),
  });
}

function useOrderStats(establishmentId: string | null, userId?: string) {
  return useQuery({
    queryKey: ['order-stats', establishmentId, userId],
    queryFn: () => {
      const url = userId
        ? `/orders/stats/${establishmentId}?userId=${userId}`
        : `/orders/stats/${establishmentId}`;
      return apiGet<any>(url);
    },
    enabled: !!establishmentId,
  });
}

function useCleaningActive(establishmentId: string | null) {
  return useQuery({
    queryKey: ['cleaning-active', establishmentId],
    queryFn: () => apiGet<any>(`/cleaning/active/${establishmentId}`),
    enabled: !!establishmentId,
  });
}

// =============================================================================
// Chart Color Palette (Teranga)
// =============================================================================

const COLORS = {
  primary: '#B85042',
  accent: '#D4A857',
  sage: '#7A9E88',
  wood: '#9C8B7E',
  woodDark: '#6B5B4E',
  primaryLight: '#D4735E',
  sageLight: '#A7BEAE',
};

// =============================================================================
// Mock Data
// =============================================================================

const stockLevelsData = [
  { name: 'Riz', stock: 150, min: 50 },
  { name: 'Huile', stock: 80, min: 30 },
  { name: 'Poulet', stock: 45, min: 40 },
  { name: 'Oignons', stock: 120, min: 25 },
  { name: 'Tomates', stock: 35, min: 30 },
];

const ordersByDayData = [
  { jour: 'Lun', commandes: 12 },
  { jour: 'Mar', commandes: 19 },
  { jour: 'Mer', commandes: 15 },
  { jour: 'Jeu', commandes: 22 },
  { jour: 'Ven', commandes: 28 },
  { jour: 'Sam', commandes: 35 },
  { jour: 'Dim', commandes: 30 },
];

const ordersByServerData = [
  { name: 'Amadou', commandes: 25 },
  { name: 'Fatou', commandes: 18 },
  { name: 'Moussa', commandes: 22 },
  { name: 'Aïda', commandes: 15 },
  { name: 'Ibrahima', commandes: 20 },
];

const paymentFlowData = [
  { mois: 'Oct', montant: 1850000 },
  { mois: 'Nov', montant: 2200000 },
  { mois: 'Déc', montant: 2750000 },
  { mois: 'Jan', montant: 1950000 },
  { mois: 'Fév', montant: 2400000 },
  { mois: 'Mar', montant: 2100000 },
];

const stockMovementsData = [
  { name: 'Achat', value: 45 },
  { name: 'Ajustement', value: 12 },
  { name: 'Perte', value: 8 },
  { name: 'Transfert', value: 15 },
  { name: 'Retour', value: 5 },
];

const processingTimeData = [
  { jour: 'Lun', minutes: 18 },
  { jour: 'Mar', minutes: 22 },
  { jour: 'Mer', minutes: 15 },
  { jour: 'Jeu', minutes: 20 },
  { jour: 'Ven', minutes: 25 },
  { jour: 'Sam', minutes: 30 },
  { jour: 'Dim', minutes: 28 },
];

const STOCK_MOVEMENT_COLORS = [
  COLORS.sage,
  COLORS.accent,
  COLORS.primary,
  COLORS.wood,
  COLORS.primaryLight,
];

// =============================================================================
// Chart Components
// =============================================================================

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-accent p-5">
      <h4 className="mb-3 font-display text-sm font-bold text-wood-700">{title}</h4>
      {children}
    </div>
  );
}

function StockLevelsChart() {
  return (
    <ChartCard title="Niveaux de stock">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={stockLevelsData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#9C8B7E' }} width={60} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="stock" name="Stock actuel" fill={COLORS.sage} radius={[0, 4, 4, 0]} />
          <Bar dataKey="min" name="Stock minimum" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function RoomOccupancyChart({ available, occupied, maintenance }: { available: number; occupied: number; maintenance: number }) {
  const data = [
    { name: 'Disponibles', value: available },
    { name: 'Occupées', value: occupied },
    { name: 'Maintenance', value: maintenance },
  ];
  const pieColors = [COLORS.sage, COLORS.accent, COLORS.primary];

  return (
    <ChartCard title="Occupation des chambres">
      <ResponsiveContainer width="100%" height={250}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={pieColors[index]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function KitchenOrdersChart() {
  return (
    <ChartCard title="Commandes cuisine">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={ordersByDayData}>
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

function OrdersByServerChart() {
  return (
    <ChartCard title="Commandes par serveur">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={ordersByServerData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Bar dataKey="commandes" name="Commandes" fill={COLORS.sage} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function PaymentFlowChart() {
  return (
    <ChartCard title="Flux de paiement">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={paymentFlowData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
          <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9C8B7E' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} formatter={(value: number) => [`${value.toLocaleString()} FCFA`, 'Montant']} />
          <Bar dataKey="montant" name="Montant (FCFA)" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function StockMovementsChart() {
  return (
    <ChartCard title="Mouvements de stock">
      <ResponsiveContainer width="100%" height={250}>
        <RechartsPieChart>
          <Pie
            data={stockMovementsData}
            cx="50%"
            cy="50%"
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {stockMovementsData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={STOCK_MOVEMENT_COLORS[index]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ProcessingTimeChart() {
  return (
    <ChartCard title="Temps de traitement des commandes">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={processingTimeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
          <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9C8B7E' }} unit=" min" />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E8D1' }} formatter={(value: number) => [`${value} min`, 'Temps moyen']} />
          <Bar dataKey="minutes" name="Minutes" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// =============================================================================
// COOK Dashboard
// =============================================================================

function CookDashboard({ establishmentId }: { establishmentId: string | null }) {
  const { data: orderStats } = useOrderStats(establishmentId);
  const stats = orderStats?.data || {};

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cuisine"
        subtitle="Suivi des commandes en cuisine"
      />
      <div className="divider-teranga" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Commandes aujourd'hui"
          value={stats.today ?? '—'}
          icon={UtensilsCrossed}
          color="accent"
        />
        <StatCard
          title="Cette semaine"
          value={stats.thisWeek ?? '—'}
          icon={ChefHat}
          color="primary"
        />
        <StatCard
          title="Ce mois"
          value={stats.thisMonth ?? '—'}
          icon={ClipboardList}
          color="sage"
        />
      </div>

      <div className="card-accent p-5">
        <h3 className="font-display font-bold text-wood-800 mb-3">Résumé</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-accent-50/40 border border-accent-200 p-4">
            <p className="text-sm text-wood-500">Commandes préparées aujourd&apos;hui</p>
            <p className="mt-1 text-xl font-bold text-wood-800">{stats.today ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-sage-50/40 border border-sage-200 p-4">
            <p className="text-sm text-wood-500">Commandes servies aujourd&apos;hui</p>
            <p className="mt-1 text-xl font-bold text-wood-800">—</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CLEANER Dashboard
// =============================================================================

function CleanerDashboard({ establishmentId }: { establishmentId: string | null }) {
  const { data: rooms } = useRoomsStats();
  const { data: cleaningActive } = useCleaningActive(establishmentId);

  const roomsData = rooms?.data || [];
  const roomsToCl = roomsData.filter((r: any) => r.status === 'CLEANING').length;
  const activeSessions = cleaningActive?.data || [];
  const completedToday = activeSessions.filter(
    (s: any) => s.status === 'COMPLETED'
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ménage"
        subtitle="Gestion du nettoyage des chambres"
      />
      <div className="divider-teranga" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Chambres à nettoyer"
          value={roomsToCl}
          subtitle={roomsToCl > 0 ? 'En attente de nettoyage' : 'Aucune chambre en attente'}
          icon={SprayCan}
          color={roomsToCl > 0 ? 'accent' : 'sage'}
        />
        <StatCard
          title="Nettoyages en cours"
          value={activeSessions.filter((s: any) => s.status === 'IN_PROGRESS').length}
          icon={SprayCan}
          color="primary"
        />
        <StatCard
          title="Nettoyées aujourd'hui"
          value={completedToday}
          icon={CheckCircle2}
          color="sage"
        />
      </div>

      <div className="card-accent p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-wood-800">Accès rapide</h3>
        </div>
        <Link
          href="/dashboard/cleaning"
          className="btn-primary inline-flex items-center gap-2"
        >
          <SprayCan className="h-4 w-4" />
          Voir les chambres à nettoyer
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// SERVER Dashboard
// =============================================================================

function ServerDashboard({
  establishmentId,
  userId,
}: {
  establishmentId: string | null;
  userId: string | undefined;
}) {
  const { data: orderStats } = useOrderStats(establishmentId);
  const { data: myOrderStats } = useOrderStats(establishmentId, userId);

  const stats = orderStats?.data || {};
  const myStats = myOrderStats?.data || {};

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vos commandes et activités"
      />
      <div className="divider-teranga" />

      <div>
        <h2 className="font-display text-lg font-bold text-wood-800 mb-4">
          Commandes globales
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Commandes aujourd'hui"
            value={stats.today ?? '—'}
            icon={UtensilsCrossed}
            color="accent"
          />
          <StatCard
            title="Cette semaine"
            value={stats.thisWeek ?? '—'}
            icon={ClipboardList}
            color="primary"
          />
          <StatCard
            title="Ce mois"
            value={stats.thisMonth ?? '—'}
            icon={TrendingUp}
            color="sage"
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-wood-800 mb-4">
          Mes commandes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Mes commandes aujourd'hui"
            value={myStats.today ?? '—'}
            icon={UtensilsCrossed}
            color="accent"
          />
          <StatCard
            title="Ma semaine"
            value={myStats.thisWeek ?? '—'}
            icon={ClipboardList}
            color="primary"
          />
          <StatCard
            title="Mon mois"
            value={myStats.thisMonth ?? '—'}
            icon={TrendingUp}
            color="sage"
          />
        </div>
      </div>

      <div className="card-accent p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-wood-800">Accès rapide</h3>
        </div>
        <Link
          href="/dashboard/orders"
          className="btn-primary inline-flex items-center gap-2"
        >
          <UtensilsCrossed className="h-4 w-4" />
          Voir les commandes
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// Shared sections for MANAGER / DAF / SUPERADMIN
// =============================================================================

function RoomsStatsSection() {
  const { data: rooms } = useRoomsStats();
  const { data: reservations } = useRecentReservations();

  const roomsData = rooms?.data || [];
  const available = roomsData.filter((r: any) => r.status === 'AVAILABLE').length;
  const occupied = roomsData.filter((r: any) => r.status === 'OCCUPIED').length;
  const totalRooms = roomsData.length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
  const recentReservations = reservations?.data || [];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Chambres disponibles"
          value={`${available} / ${totalRooms}`}
          subtitle={`${occupancyRate}% d'occupation`}
          icon={BedDouble}
          color="sage"
        />
        <StatCard
          title="Réservations actives"
          value={reservations?.meta?.total || 0}
          icon={CalendarCheck}
          color="accent"
        />
        <StatCard
          title="Chambres occupées"
          value={occupied}
          icon={BedDouble}
          color="primary"
        />
        <StatCard
          title="En maintenance"
          value={roomsData.filter((r: any) => r.status === 'MAINTENANCE').length}
          icon={BedDouble}
          color="amber"
        />
      </div>

      <div className="card-accent">
        <div className="flex items-center justify-between border-b border-wood-100 px-5 py-4">
          <h3 className="font-display font-bold text-wood-800">Dernières réservations</h3>
          <Link
            href="/dashboard/reservations"
            className="text-sm text-primary-500 hover:text-primary-600 font-semibold"
          >
            Voir tout
          </Link>
        </div>
        <div className="divide-y divide-wood-50">
          {recentReservations.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-wood-400">
              Aucune réservation
            </p>
          ) : (
            recentReservations.map((res: any) => (
              <Link
                key={res.id}
                href="/dashboard/reservations"
                className="flex items-center justify-between px-5 py-3.5 hover:bg-accent-50/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-wood-800">{res.guestName}</p>
                  <p className="text-xs text-wood-500">
                    Chambre {res.room?.number} — {formatDate(res.checkIn)} &rarr;{' '}
                    {formatDate(res.checkOut)}
                  </p>
                </div>
                <StatusBadge status={res.status} />
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function OrderStatsSection({ establishmentId }: { establishmentId: string | null }) {
  const { data: orderStats } = useOrderStats(establishmentId);
  const stats = orderStats?.data || {};

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-wood-800 mb-4">Commandes</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Commandes aujourd'hui"
          value={stats.today ?? '—'}
          icon={UtensilsCrossed}
          color="accent"
        />
        <StatCard
          title="Cette semaine"
          value={stats.thisWeek ?? '—'}
          icon={ClipboardList}
          color="primary"
        />
        <StatCard
          title="Ce mois"
          value={stats.thisMonth ?? '—'}
          icon={TrendingUp}
          color="sage"
        />
      </div>
    </div>
  );
}

function InvoicesSection() {
  const { data: invoices } = useRecentInvoices();
  const recentInvoices = invoices?.data || [];

  return (
    <div className="card-accent">
      <div className="flex items-center justify-between border-b border-wood-100 px-5 py-4">
        <h3 className="font-display font-bold text-wood-800">Dernières factures</h3>
        <Link
          href="/dashboard/invoices"
          className="text-sm text-primary-500 hover:text-primary-600 font-semibold"
        >
          Voir tout
        </Link>
      </div>
      <div className="divide-y divide-wood-50">
        {recentInvoices.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-wood-400">Aucune facture</p>
        ) : (
          recentInvoices.map((inv: any) => (
            <div
              key={inv.id}
              className="flex items-center justify-between px-5 py-3.5"
            >
              <div>
                <p className="text-sm font-semibold text-wood-800">{inv.invoiceNumber}</p>
                <p className="text-xs text-wood-500">
                  {inv.reservation?.guestName || 'Client direct'} —{' '}
                  {formatDate(inv.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-wood-800">
                  {formatCurrency(inv.totalAmount)}
                </p>
                <StatusBadge status={inv.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StockAlertsSection() {
  const { data: lowStock } = useLowStock();
  const lowStockItems = (lowStock as any)?.data || [];

  return (
    <>
      <StatCard
        title="Alertes stock"
        value={lowStockItems.length}
        subtitle={lowStockItems.length > 0 ? 'Articles sous le seuil' : 'Tout est OK'}
        icon={lowStockItems.length > 0 ? AlertTriangle : Package}
        color={lowStockItems.length > 0 ? 'red' : 'sage'}
      />
      {lowStockItems.length > 0 && (
        <div className="card border-accent-300 bg-accent-50/30 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-accent-200 px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-accent-700" />
            <h3 className="font-display font-bold text-accent-900">
              Alertes de stock bas
            </h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.slice(0, 6).map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg bg-white border border-accent-200 p-3"
              >
                <p className="text-sm font-semibold text-wood-800">{item.name}</p>
                <p className="text-xs text-wood-500 font-mono">{item.sku}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-accent-800">
                    Stock:{' '}
                    <strong>{item.current_stock || item.currentStock}</strong> / Min:{' '}
                    {item.minimum_stock || item.minimumStock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// MANAGER Dashboard
// =============================================================================

function ManagerDashboard({ establishmentId }: { establishmentId: string | null }) {
  const { data: rooms } = useRoomsStats();
  const { data: lowStock } = useLowStock();
  const { data: invoices } = useRecentInvoices();
  const lowStockItems = (lowStock as any)?.data || [];
  const recentInvoices = invoices?.data || [];

  const roomsData = rooms?.data || [];
  const mgrAvailable = roomsData.filter((r: any) => r.status === 'AVAILABLE').length;
  const mgrOccupied = roomsData.filter((r: any) => r.status === 'OCCUPIED').length;
  const mgrMaintenance = roomsData.filter((r: any) => r.status === 'MAINTENANCE').length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre établissement"
      />
      <div className="divider-teranga" />

      {/* Room & reservation stats */}
      <RoomsStatsSection />

      {/* Order stats */}
      <OrderStatsSection establishmentId={establishmentId} />

      {/* Invoices & stock */}
      <div className="grid gap-6 lg:grid-cols-2">
        <InvoicesSection />
        <div className="space-y-4">
          <StatCard
            title="Factures en attente"
            value={
              recentInvoices.filter((i: any) =>
                ['ISSUED', 'OVERDUE'].includes(i.status)
              ).length
            }
            icon={Receipt}
            color="amber"
          />
          <StockAlertsSection />
        </div>
      </div>

      {/* Charts */}
      <div>
        <h2 className="font-display text-lg font-bold text-wood-800 mb-4">
          Analyses
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StockLevelsChart />
          <RoomOccupancyChart available={mgrAvailable} occupied={mgrOccupied} maintenance={mgrMaintenance} />
          <KitchenOrdersChart />
          <OrdersByServerChart />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DAF Dashboard
// =============================================================================

function DafDashboard({ establishmentId }: { establishmentId: string | null }) {
  const { data: lowStock } = useLowStock();
  const { data: rooms } = useRoomsStats();
  const { data: invoices } = useRecentInvoices();
  const lowStockItems = (lowStock as any)?.data || [];
  const recentInvoices = invoices?.data || [];
  const roomsData = rooms?.data || [];

  // Room status breakdown
  const statusCounts: Record<string, number> = {};
  roomsData.forEach((r: any) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  const dafAvailable = roomsData.filter((r: any) => r.status === 'AVAILABLE').length;
  const dafOccupied = roomsData.filter((r: any) => r.status === 'OCCUPIED').length;
  const dafMaintenance = roomsData.filter((r: any) => r.status === 'MAINTENANCE').length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Direction Administrative et Financière"
      />
      <div className="divider-teranga" />

      {/* Room & reservation stats */}
      <RoomsStatsSection />

      {/* Order stats */}
      <OrderStatsSection establishmentId={establishmentId} />

      {/* DAF-specific cards */}
      <div>
        <h2 className="font-display text-lg font-bold text-wood-800 mb-4">
          Indicateurs financiers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-accent p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-sage-50 p-2.5 text-sage-700">
                <DollarSign className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-medium text-wood-500">Flux de paiement</h4>
            </div>
            <p className="text-2xl font-bold text-wood-800">—</p>
            <p className="mt-0.5 text-xs text-wood-400">Données en cours de calcul</p>
          </div>

          <div className="card-accent p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-accent-50 p-2.5 text-accent-700">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-medium text-wood-500">Mouvements de stock</h4>
            </div>
            <p className="text-2xl font-bold text-wood-800">—</p>
            <p className="mt-0.5 text-xs text-wood-400">Entrées / sorties du mois</p>
          </div>

          <div className="card-accent p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary-50 p-2.5 text-primary-500">
                <Clock className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-medium text-wood-500">Temps de traitement</h4>
            </div>
            <p className="text-2xl font-bold text-wood-800">—</p>
            <p className="mt-0.5 text-xs text-wood-400">Temps moyen de commande</p>
          </div>

          <div className="card-accent p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-wood-100 p-2.5 text-wood-500">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-medium text-wood-500">Statut des chambres</h4>
            </div>
            <div className="space-y-1 mt-1">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <StatusBadge status={status} />
                  <span className="font-bold text-wood-700">{count}</span>
                </div>
              ))}
              {Object.keys(statusCounts).length === 0 && (
                <p className="text-xs text-wood-400">Aucune chambre</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices & stock */}
      <div className="grid gap-6 lg:grid-cols-2">
        <InvoicesSection />
        <div className="space-y-4">
          <StatCard
            title="Factures en attente"
            value={
              recentInvoices.filter((i: any) =>
                ['ISSUED', 'OVERDUE'].includes(i.status)
              ).length
            }
            icon={Receipt}
            color="amber"
          />
          <StockAlertsSection />
        </div>
      </div>

      {/* Charts — MANAGER charts + DAF extras */}
      <div>
        <h2 className="font-display text-lg font-bold text-wood-800 mb-4">
          Analyses
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StockLevelsChart />
          <RoomOccupancyChart available={dafAvailable} occupied={dafOccupied} maintenance={dafMaintenance} />
          <KitchenOrdersChart />
          <OrdersByServerChart />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          <PaymentFlowChart />
          <StockMovementsChart />
          <ProcessingTimeChart />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUPERADMIN / Default Dashboard (full view)
// =============================================================================

function SuperadminDashboard({ establishmentId }: { establishmentId: string | null }) {
  const { data: rooms, isLoading: roomsLoading } = useRoomsStats();
  const { data: reservations } = useRecentReservations();
  const { data: lowStock } = useLowStock();
  const { data: invoices } = useRecentInvoices();

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
      <div className="divider-teranga" />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Chambres disponibles"
          value={`${available} / ${totalRooms}`}
          subtitle={`${occupancyRate}% d'occupation`}
          icon={BedDouble}
          color="sage"
        />
        <StatCard
          title="Réservations actives"
          value={reservations?.meta?.total || 0}
          icon={CalendarCheck}
          color="accent"
        />
        <StatCard
          title="Factures en attente"
          value={
            recentInvoices.filter((i: any) =>
              ['ISSUED', 'OVERDUE'].includes(i.status)
            ).length
          }
          icon={Receipt}
          color="amber"
        />
        <StatCard
          title="Alertes stock"
          value={lowStockItems.length}
          subtitle={
            lowStockItems.length > 0 ? 'Articles sous le seuil' : 'Tout est OK'
          }
          icon={lowStockItems.length > 0 ? AlertTriangle : Package}
          color={lowStockItems.length > 0 ? 'red' : 'sage'}
        />
      </div>

      {/* Order stats */}
      <OrderStatsSection establishmentId={establishmentId} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Reservations */}
        <div className="card-accent">
          <div className="flex items-center justify-between border-b border-wood-100 px-5 py-4">
            <h3 className="font-display font-bold text-wood-800">
              Dernières réservations
            </h3>
            <Link
              href="/dashboard/reservations"
              className="text-sm text-primary-500 hover:text-primary-600 font-semibold"
            >
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-wood-50">
            {recentReservations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-wood-400">
                Aucune réservation
              </p>
            ) : (
              recentReservations.map((res: any) => (
                <Link
                  key={res.id}
                  href="/dashboard/reservations"
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-accent-50/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-wood-800">
                      {res.guestName}
                    </p>
                    <p className="text-xs text-wood-500">
                      Chambre {res.room?.number} — {formatDate(res.checkIn)} &rarr;{' '}
                      {formatDate(res.checkOut)}
                    </p>
                  </div>
                  <StatusBadge status={res.status} />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <InvoicesSection />
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="card border-accent-300 bg-accent-50/30">
          <div className="flex items-center gap-3 border-b border-accent-200 px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-accent-700" />
            <h3 className="font-display font-bold text-accent-900">
              Alertes de stock bas
            </h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.slice(0, 6).map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg bg-white border border-accent-200 p-3"
              >
                <p className="text-sm font-semibold text-wood-800">{item.name}</p>
                <p className="text-xs text-wood-500 font-mono">{item.sku}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-accent-800">
                    Stock:{' '}
                    <strong>
                      {item.current_stock || item.currentStock}
                    </strong>{' '}
                    / Min: {item.minimum_stock || item.minimumStock}
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

// =============================================================================
// Main Dashboard Page — role-based routing
// =============================================================================

export default function DashboardPage() {
  const { user, currentEstablishmentRole, currentEstablishmentId } = useAuthStore();

  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const role: EstablishmentRole | null = currentEstablishmentRole;

  // SUPERADMIN without a specific establishment role sees everything
  if (isSuperAdmin && !role) {
    return <SuperadminDashboard establishmentId={currentEstablishmentId} />;
  }

  switch (role) {
    case 'COOK':
      return <CookDashboard establishmentId={currentEstablishmentId} />;
    case 'CLEANER':
      return <CleanerDashboard establishmentId={currentEstablishmentId} />;
    case 'SERVER':
    case 'POS':
      return (
        <ServerDashboard
          establishmentId={currentEstablishmentId}
          userId={user?.id}
        />
      );
    case 'MANAGER':
      return <ManagerDashboard establishmentId={currentEstablishmentId} />;
    case 'DAF':
      return <DafDashboard establishmentId={currentEstablishmentId} />;
    default:
      return <SuperadminDashboard establishmentId={currentEstablishmentId} />;
  }
}
