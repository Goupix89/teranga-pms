'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { PageHeader, StatCard, StatusBadge, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuthStore';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  BarChart3, BedDouble, TrendingUp, Users, Download,
  CalendarCheck, UtensilsCrossed, DollarSign, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

const COLORS = {
  primary: '#B85042',
  accent: '#D4A857',
  sage: '#7A9E88',
  wood: '#9C8B7E',
  primaryLight: '#D4735E',
  sageLight: '#A7BEAE',
};
const PIE_COLORS = [COLORS.sage, COLORS.accent, COLORS.primary, COLORS.wood, COLORS.primaryLight];

type ReportPeriod = 'today' | 'week' | 'month' | 'quarter';

export default function ReportsPage() {
  const { user, currentEstablishmentId, currentEstablishmentRole } = useAuthStore();
  const [period, setPeriod] = useState<ReportPeriod>('month');

  const isDAF = currentEstablishmentRole === 'DAF' || user?.role === 'SUPERADMIN';

  // Data hooks
  const { data: rooms } = useQuery({
    queryKey: ['report-rooms'],
    queryFn: () => apiGet<any>('/rooms?limit=200'),
  });

  const { data: orders } = useQuery({
    queryKey: ['report-orders'],
    queryFn: () => apiGet<any>('/orders?limit=500'),
  });

  const { data: reservations } = useQuery({
    queryKey: ['report-reservations'],
    queryFn: () => apiGet<any>('/reservations?limit=500'),
  });

  const { data: invoices } = useQuery({
    queryKey: ['report-invoices'],
    queryFn: () => apiGet<any>('/invoices?limit=500'),
  });

  const { data: usersData } = useQuery({
    queryKey: ['report-users'],
    queryFn: () => apiGet<any>('/users?limit=100'),
    enabled: isDAF,
  });

  const { data: orderStats } = useQuery({
    queryKey: ['report-order-stats', currentEstablishmentId],
    queryFn: () => apiGet<any>(`/orders/stats/${currentEstablishmentId}`),
    enabled: !!currentEstablishmentId,
  });

  const roomList = rooms?.data || [];
  const orderList = orders?.data || [];
  const reservationList = reservations?.data || [];
  const invoiceList = invoices?.data || [];
  const userList = usersData?.data || [];
  const stats = orderStats?.data || {};

  // --- Computed metrics ---

  // Room occupancy
  const totalRooms = roomList.length;
  const occupied = roomList.filter((r: any) => r.status === 'OCCUPIED').length;
  const available = roomList.filter((r: any) => r.status === 'AVAILABLE').length;
  const maintenance = roomList.filter((r: any) => r.status === 'MAINTENANCE').length;
  const cleaning = roomList.filter((r: any) => r.status === 'CLEANING').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

  // Revenue
  const totalRevenue = orderList.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
  const paidInvoices = invoiceList.filter((i: any) => i.status === 'PAID');
  const totalPaid = paidInvoices.reduce((sum: number, i: any) => sum + (Number(i.totalAmount) || 0), 0);
  const pendingInvoices = invoiceList.filter((i: any) => ['ISSUED', 'OVERDUE'].includes(i.status));
  const totalPending = pendingInvoices.reduce((sum: number, i: any) => sum + (Number(i.totalAmount) || 0), 0);

  // Orders per server
  const serverOrders: Record<string, { name: string; count: number; revenue: number }> = {};
  orderList.forEach((o: any) => {
    if (o.createdBy) {
      const key = o.createdBy.id;
      if (!serverOrders[key]) {
        serverOrders[key] = { name: `${o.createdBy.firstName} ${o.createdBy.lastName}`, count: 0, revenue: 0 };
      }
      serverOrders[key].count++;
      serverOrders[key].revenue += Number(o.totalAmount) || 0;
    }
  });
  const serverChartData = Object.values(serverOrders).sort((a, b) => b.count - a.count);

  // Orders by status
  const statusCounts: Record<string, number> = {};
  orderList.forEach((o: any) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });
  const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Room status pie
  const roomStatusData = [
    { name: 'Disponibles', value: available },
    { name: 'Occupées', value: occupied },
    { name: 'Nettoyage', value: cleaning },
    { name: 'Maintenance', value: maintenance },
  ].filter(d => d.value > 0);

  // Payment methods breakdown
  const paymentCounts: Record<string, number> = {};
  orderList.forEach((o: any) => {
    const pm = o.paymentMethod || 'NON_DEFINI';
    paymentCounts[pm] = (paymentCounts[pm] || 0) + 1;
  });
  const paymentLabels: Record<string, string> = {
    MOOV_MONEY: 'Flooz', MIXX_BY_YAS: 'Yas', CASH: 'Espèces',
    CARD: 'Carte', MOBILE_MONEY: 'Mobile Money', BANK_TRANSFER: 'Virement', NON_DEFINI: 'Non défini',
  };
  const paymentChartData = Object.entries(paymentCounts).map(([key, value]) => ({
    name: paymentLabels[key] || key, value,
  }));

  // Export CSV
  const exportCSV = (type: 'orders' | 'rooms' | 'servers') => {
    let csv = '';
    if (type === 'orders') {
      csv = 'N° Commande,Date,Serveur,Total,Statut,Paiement\n';
      orderList.forEach((o: any) => {
        csv += `${o.orderNumber},${o.createdAt},${o.createdBy?.firstName || ''} ${o.createdBy?.lastName || ''},${o.totalAmount},${o.status},${o.paymentMethod || ''}\n`;
      });
    } else if (type === 'rooms') {
      csv = 'Chambre,Statut,Type,Étage\n';
      roomList.forEach((r: any) => {
        csv += `${r.number},${r.status},${r.type || ''},${r.floor || ''}\n`;
      });
    } else if (type === 'servers') {
      csv = 'Serveur,Commandes,Revenus générés\n';
      serverChartData.forEach((s) => {
        csv += `${s.name},${s.count},${s.revenue}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Rapports d'activité"
        subtitle="Analyse de performance de l'établissement"
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('orders')} className="btn-secondary text-sm">
              <Download className="mr-1.5 h-4 w-4" /> Commandes
            </button>
            <button onClick={() => exportCSV('rooms')} className="btn-secondary text-sm">
              <Download className="mr-1.5 h-4 w-4" /> Chambres
            </button>
            {isDAF && (
              <button onClick={() => exportCSV('servers')} className="btn-secondary text-sm">
                <Download className="mr-1.5 h-4 w-4" /> Serveurs
              </button>
            )}
          </div>
        }
      />

      <div className="divider-teranga" />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Taux d'occupation"
          value={`${occupancyRate}%`}
          subtitle={`${occupied} / ${totalRooms} chambres`}
          icon={BedDouble}
          color="sage"
        />
        <StatCard
          title="Revenus totaux"
          value={formatCurrency(totalRevenue)}
          subtitle={`${orderList.length} commandes`}
          icon={TrendingUp}
          color="accent"
        />
        <StatCard
          title="Factures en attente"
          value={formatCurrency(totalPending)}
          subtitle={`${pendingInvoices.length} factures`}
          icon={DollarSign}
          color="primary"
        />
        <StatCard
          title="Commandes aujourd'hui"
          value={stats.today ?? '—'}
          subtitle={`Semaine: ${stats.thisWeek ?? '—'} | Mois: ${stats.thisMonth ?? '—'}`}
          icon={UtensilsCrossed}
          color="accent"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Room Occupancy Pie */}
        <div className="card-accent p-5">
          <h4 className="mb-3 font-display text-sm font-bold text-wood-700">Occupation des chambres</h4>
          <ResponsiveContainer width="100%" height={280}>
            <RechartsPieChart>
              <Pie
                data={roomStatusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {roomStatusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods Pie */}
        <div className="card-accent p-5">
          <h4 className="mb-3 font-display text-sm font-bold text-wood-700">Modes de paiement</h4>
          <ResponsiveContainer width="100%" height={280}>
            <RechartsPieChart>
              <Pie
                data={paymentChartData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {paymentChartData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Server Performance */}
      <div className="card-accent p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-sm font-bold text-wood-700">Performance par serveur</h4>
          {isDAF && (
            <button onClick={() => exportCSV('servers')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              Exporter CSV
            </button>
          )}
        </div>
        {serverChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serverChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9C8B7E' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number, name: string) => [name === 'revenue' ? formatCurrency(value) : value, name === 'revenue' ? 'Revenus' : 'Commandes']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="count" name="Commandes" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="revenue" name="Revenus" fill={COLORS.sage} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-wood-400 py-8">Aucune donnée de serveur</p>
        )}
      </div>

      {/* Server Performance Table */}
      {serverChartData.length > 0 && (
        <div className="card">
          <div className="border-b border-wood-100 px-5 py-4">
            <h3 className="font-display font-bold text-wood-800">Détails par serveur</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Serveur</th>
                  <th>Commandes</th>
                  <th>Revenus générés</th>
                  <th>Moy. / commande</th>
                </tr>
              </thead>
              <tbody>
                {serverChartData.map((s, i) => (
                  <tr key={i}>
                    <td className="font-medium text-gray-900">{s.name}</td>
                    <td className="font-semibold">{s.count}</td>
                    <td className="font-semibold text-sage-700">{formatCurrency(s.revenue)}</td>
                    <td className="text-gray-500">{s.count > 0 ? formatCurrency(s.revenue / s.count) : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-wood-50 font-bold">
                  <td>Total</td>
                  <td>{serverChartData.reduce((s, x) => s + x.count, 0)}</td>
                  <td className="text-sage-700">{formatCurrency(serverChartData.reduce((s, x) => s + x.revenue, 0))}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reservations summary */}
      <div className="card-accent p-5">
        <h4 className="mb-4 font-display text-sm font-bold text-wood-700">Réservations</h4>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-sage-50/50 border border-sage-200 p-4 text-center">
            <p className="text-2xl font-bold text-sage-700">{reservationList.filter((r: any) => r.status === 'CONFIRMED').length}</p>
            <p className="text-xs text-sage-600 mt-1">Confirmées</p>
          </div>
          <div className="rounded-lg bg-accent-50/50 border border-accent-200 p-4 text-center">
            <p className="text-2xl font-bold text-accent-700">{reservationList.filter((r: any) => r.status === 'CHECKED_IN').length}</p>
            <p className="text-xs text-accent-600 mt-1">En cours</p>
          </div>
          <div className="rounded-lg bg-primary-50/50 border border-primary-200 p-4 text-center">
            <p className="text-2xl font-bold text-primary-700">{reservationList.filter((r: any) => r.status === 'CHECKED_OUT').length}</p>
            <p className="text-xs text-primary-600 mt-1">Terminées</p>
          </div>
          <div className="rounded-lg bg-wood-50 border border-wood-200 p-4 text-center">
            <p className="text-2xl font-bold text-wood-700">{reservationList.filter((r: any) => r.status === 'CANCELLED').length}</p>
            <p className="text-xs text-wood-600 mt-1">Annulées</p>
          </div>
        </div>
      </div>

      {/* Order Status Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-accent p-5">
          <h4 className="mb-3 font-display text-sm font-bold text-wood-700">Statut des commandes</h4>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${value}`}
              >
                {statusChartData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    PENDING: 'En attente', IN_PROGRESS: 'En cours', READY: 'Prête',
                    SERVED: 'Servie', CANCELLED: 'Annulée', COMPLETED: 'Terminée',
                  };
                  return labels[value] || value;
                }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue summary */}
        <div className="card-accent p-5">
          <h4 className="mb-4 font-display text-sm font-bold text-wood-700">Revenus</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-sage-50/50 border border-sage-200 p-4">
              <div>
                <p className="text-sm text-sage-600">Revenus des commandes</p>
                <p className="text-2xl font-bold text-sage-800">{formatCurrency(totalRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-sage-400" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-accent-50/50 border border-accent-200 p-4">
              <div>
                <p className="text-sm text-accent-600">Factures payées</p>
                <p className="text-2xl font-bold text-accent-800">{formatCurrency(totalPaid)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-accent-400" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary-50/50 border border-primary-200 p-4">
              <div>
                <p className="text-sm text-primary-600">Factures en attente</p>
                <p className="text-2xl font-bold text-primary-800">{formatCurrency(totalPending)}</p>
              </div>
              <Clock className="h-8 w-8 text-primary-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
