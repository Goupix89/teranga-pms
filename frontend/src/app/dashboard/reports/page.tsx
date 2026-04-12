'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { api } from '@/lib/api';
import { PageHeader, StatCard, StatusBadge, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuthStore';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  BedDouble, TrendingUp, Download, FileText,
  UtensilsCrossed, DollarSign, Clock,
  Package, ShoppingCart, Wallet, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer,
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
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [rangeFrom, setRangeFrom] = useState(thirtyDaysAgo);
  const [rangeTo, setRangeTo] = useState(today);
  const [showRange, setShowRange] = useState(false);
  const [isDownloadingRangePdf, setIsDownloadingRangePdf] = useState(false);

  const isDAF = currentEstablishmentRole === 'DAF' || user?.role === 'SUPERADMIN';

  // Daily report (encaissements for the selected date)
  const { data: dailyReport } = useQuery({
    queryKey: ['daily-report', reportDate, currentEstablishmentId],
    queryFn: () => apiGet<any>(`/reports/daily?date=${reportDate}${currentEstablishmentId ? `&establishmentId=${currentEstablishmentId}` : ''}`),
  });
  const daily = dailyReport?.data;

  // Range report (multi-day)
  const { data: rangeReport } = useQuery({
    queryKey: ['range-report', rangeFrom, rangeTo, currentEstablishmentId, showRange],
    queryFn: () => apiGet<any>(`/reports/range?from=${rangeFrom}&to=${rangeTo}${currentEstablishmentId ? `&establishmentId=${currentEstablishmentId}` : ''}`),
    enabled: showRange && !!rangeFrom && !!rangeTo,
  });
  const range = rangeReport?.data;

  const downloadRangePdf = async () => {
    setIsDownloadingRangePdf(true);
    try {
      const res = await api.get(`/reports/range-pdf?from=${rangeFrom}&to=${rangeTo}${currentEstablishmentId ? `&establishmentId=${currentEstablishmentId}` : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-${rangeFrom}_${rangeTo}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { }
    setIsDownloadingRangePdf(false);
  };

  const downloadDailyPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await api.get(`/reports/daily-pdf?date=${reportDate}${currentEstablishmentId ? `&establishmentId=${currentEstablishmentId}` : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-${reportDate}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { }
    setIsDownloadingPdf(false);
  };

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

  const { data: stockMovements } = useQuery({
    queryKey: ['report-stock-movements'],
    queryFn: () => apiGet<any>('/stock-movements?limit=500'),
    enabled: isDAF,
  });

  const { data: articles } = useQuery({
    queryKey: ['report-articles'],
    queryFn: () => apiGet<any>('/articles?limit=500'),
  });

  const roomList = rooms?.data || [];
  const orderList = orders?.data || [];
  const reservationList = reservations?.data || [];
  const invoiceList = invoices?.data || [];
  const userList = usersData?.data || [];
  const stats = orderStats?.data || {};
  const movementList = stockMovements?.data || [];
  const articleList = articles?.data || [];

  // --- Computed metrics ---

  // Room occupancy
  const totalRooms = roomList.length;
  const occupied = roomList.filter((r: any) => r.status === 'OCCUPIED').length;
  const available = roomList.filter((r: any) => r.status === 'AVAILABLE').length;
  const maintenance = roomList.filter((r: any) => r.status === 'MAINTENANCE').length;
  const cleaning = roomList.filter((r: any) => r.status === 'CLEANING').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

  // Identify merged source orders (order numbers referenced in "Regroupement:" notes)
  const mergedSourceOrderNumbers = new Set<string>();
  orderList.forEach((o: any) => {
    if (o.notes?.startsWith('Regroupement:')) {
      const nums = o.notes.replace('Regroupement:', '').split(',').map((s: string) => s.trim());
      nums.forEach((n: string) => mergedSourceOrderNumbers.add(n));
    }
  });

  // Active orders: exclude cancelled, pending, and merged source orders
  const cancelledOrders = orderList.filter((o: any) => o.status === 'CANCELLED');
  const cancelledCount = cancelledOrders.length;
  const activeOrders = orderList.filter((o: any) =>
    o.status !== 'CANCELLED' &&
    o.status !== 'PENDING' &&
    !mergedSourceOrderNumbers.has(o.orderNumber)
  );

  // Separate voucher orders from CA
  const voucherOrders = activeOrders.filter((o: any) => o.isVoucher);
  const nonVoucherOrders = activeOrders.filter((o: any) => !o.isVoucher);
  const voucherTotal = voucherOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);

  // Revenue: orders (non-cancelled, non-pending, non-merged-source, non-voucher) + manual invoices paid
  const orderRevenue = nonVoucherOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
  const paidInvoices = invoiceList.filter((i: any) => i.status === 'PAID');
  // Manual invoices = paid invoices with no linked orders (created from invoices menu)
  const manualPaidInvoices = paidInvoices.filter((i: any) => !i.orders || i.orders.length === 0);
  const manualPaidTotal = manualPaidInvoices.reduce((sum: number, i: any) => sum + (Number(i.totalAmount) || 0), 0);
  const totalRevenue = orderRevenue + manualPaidTotal;
  const totalPaid = paidInvoices.reduce((sum: number, i: any) => sum + (Number(i.totalAmount) || 0), 0);
  const pendingInvoices = invoiceList.filter((i: any) => ['ISSUED', 'OVERDUE'].includes(i.status));
  const totalPending = pendingInvoices.reduce((sum: number, i: any) => sum + (Number(i.totalAmount) || 0), 0);

  // Orders per server — exclude cancelled, pending, and merged source orders
  const serverOrders: Record<string, { name: string; count: number; revenue: number }> = {};
  activeOrders.forEach((o: any) => {
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

  // Orders by status (all orders for visibility)
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

  // Payment methods breakdown (active orders only)
  const paymentCounts: Record<string, number> = {};
  activeOrders.forEach((o: any) => {
    const pm = o.paymentMethod || 'NON_DEFINI';
    paymentCounts[pm] = (paymentCounts[pm] || 0) + 1;
  });
  const paymentLabels: Record<string, string> = {
    MOOV_MONEY: 'Flooz', MIXX_BY_YAS: 'Yas', CASH: 'Espèces',
    CARD: 'Carte', MOBILE_MONEY: 'Mobile Money', FEDAPAY: 'FedaPay', BANK_TRANSFER: 'Virement', NON_DEFINI: 'Non défini',
  };
  const paymentChartData = Object.entries(paymentCounts).map(([key, value]) => ({
    name: paymentLabels[key] || key, value,
  }));

  // --- Purchases (stock movements of type PURCHASE) ---
  const purchases = movementList.filter((m: any) => m.type === 'PURCHASE');
  const totalPurchasesCost = purchases.reduce((sum: number, m: any) => sum + (Number(m.unitCost) || 0) * Math.abs(m.quantity), 0);
  const purchasesByArticle: Record<string, { name: string; quantity: number; cost: number }> = {};
  purchases.forEach((m: any) => {
    const name = m.article?.name || 'Inconnu';
    const key = m.articleId || name;
    if (!purchasesByArticle[key]) purchasesByArticle[key] = { name, quantity: 0, cost: 0 };
    purchasesByArticle[key].quantity += Math.abs(m.quantity);
    purchasesByArticle[key].cost += (Number(m.unitCost) || 0) * Math.abs(m.quantity);
  });
  const purchasesChartData = Object.values(purchasesByArticle).sort((a, b) => b.cost - a.cost);

  // --- Stock report ---
  const stockAlerts = articleList.filter((a: any) => a.isApproved !== false && a.currentStock <= a.minimumStock);
  const totalStockValue = articleList.reduce((sum: number, a: any) => sum + (Number(a.costPrice) || 0) * (a.currentStock || 0), 0);
  const stockByCategory: Record<string, { name: string; count: number; value: number }> = {};
  articleList.forEach((a: any) => {
    const cat = a.category?.name || 'Sans catégorie';
    if (!stockByCategory[cat]) stockByCategory[cat] = { name: cat, count: 0, value: 0 };
    stockByCategory[cat].count += a.currentStock || 0;
    stockByCategory[cat].value += (Number(a.costPrice) || 0) * (a.currentStock || 0);
  });
  const stockCategoryData = Object.values(stockByCategory);

  // --- Cash register (caisse) — use activeOrders (excludes cancelled, pending, merged source) ---
  const cashOrders = activeOrders.filter((o: any) => o.paymentMethod === 'CASH');
  const totalCash = cashOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
  const cardOrders = activeOrders.filter((o: any) => o.paymentMethod === 'CARD');
  const totalCard = cardOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
  const mobileOrders = activeOrders.filter((o: any) => ['MOBILE_MONEY', 'MOOV_MONEY', 'MIXX_BY_YAS', 'FEDAPAY'].includes(o.paymentMethod));
  const totalMobile = mobileOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
  const totalCaisse = totalCash + totalCard + totalMobile;

  const caisseData = [
    { name: 'Espèces', value: totalCash, count: cashOrders.length },
    { name: 'Carte', value: totalCard, count: cardOrders.length },
    { name: 'Mobile / FedaPay', value: totalMobile, count: mobileOrders.length },
  ];

  // Export CSV
  const exportCSV = (type: 'orders' | 'rooms' | 'servers' | 'purchases' | 'stock' | 'caisse') => {
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
    } else if (type === 'purchases') {
      csv = 'Article,Quantité,Coût total\n';
      purchasesChartData.forEach((p) => {
        csv += `${p.name},${p.quantity},${p.cost}\n`;
      });
    } else if (type === 'stock') {
      csv = 'Article,Catégorie,Stock actuel,Stock minimum,Unité,Prix achat,Valeur stock\n';
      articleList.forEach((a: any) => {
        csv += `${a.name},${a.category?.name || ''},${a.currentStock},${a.minimumStock},${a.unit},${Number(a.costPrice) || 0},${(Number(a.costPrice) || 0) * (a.currentStock || 0)}\n`;
      });
    } else if (type === 'caisse') {
      csv = 'Mode,Nombre transactions,Montant total\n';
      caisseData.forEach((c) => {
        csv += `${c.name},${c.count},${c.value}\n`;
      });
      csv += `\nDétail des transactions\nN° Commande,Date,Montant,Mode paiement,Serveur\n`;
      activeOrders.filter((o: any) => o.paymentMethod).forEach((o: any) => {
        csv += `${o.orderNumber},${o.createdAt},${o.totalAmount},${paymentLabels[o.paymentMethod] || o.paymentMethod},${o.createdBy?.firstName || ''} ${o.createdBy?.lastName || ''}\n`;
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="input text-sm h-9 w-40"
            />
            <button onClick={downloadDailyPdf} disabled={isDownloadingPdf} className="btn-primary text-sm">
              {isDownloadingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
              PDF du jour
            </button>
            <button onClick={() => setShowRange((v) => !v)} className="btn-secondary text-sm">
              <FileText className="mr-1.5 h-4 w-4" />
              {showRange ? 'Masquer période' : 'Période multi-jours'}
            </button>
            <button onClick={() => exportCSV('orders')} className="btn-secondary text-sm">
              <Download className="mr-1.5 h-4 w-4" /> Commandes
            </button>
            <button onClick={() => exportCSV('caisse')} className="btn-secondary text-sm">
              <Download className="mr-1.5 h-4 w-4" /> Caisse
            </button>
            <button onClick={() => exportCSV('stock')} className="btn-secondary text-sm">
              <Download className="mr-1.5 h-4 w-4" /> Stock
            </button>
            {isDAF && (
              <>
                <button onClick={() => exportCSV('purchases')} className="btn-secondary text-sm">
                  <Download className="mr-1.5 h-4 w-4" /> Achats
                </button>
                <button onClick={() => exportCSV('servers')} className="btn-secondary text-sm">
                  <Download className="mr-1.5 h-4 w-4" /> Serveurs
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="divider-teranga" />

      {showRange && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Du</label>
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="input h-9 w-40 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Au</label>
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="input h-9 w-40 text-sm" />
            </div>
            <button onClick={downloadRangePdf} disabled={isDownloadingRangePdf} className="btn-primary text-sm">
              {isDownloadingRangePdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
              PDF période
            </button>
          </div>
          {range && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Encaissements totaux</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(range.grandTotal || 0)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Bons propriétaires</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(range.grandVoucher || 0)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Paiements</p>
                  <p className="text-lg font-bold text-slate-900">{range.grandPayments || 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Moy. / jour</p>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(range.days?.length ? (range.grandTotal || 0) / range.days.length : 0)}
                  </p>
                </div>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-2">Date</th>
                      <th className="py-2">Encaissements</th>
                      <th className="py-2">Bons</th>
                      <th className="py-2">Nb paiements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(range.days || []).map((d: any) => (
                      <tr key={d.date} className="border-b last:border-0">
                        <td className="py-2">{d.date}</td>
                        <td className="py-2 font-medium">{formatCurrency(d.total || 0)}</td>
                        <td className="py-2 text-slate-500">{formatCurrency(d.voucherTotal || 0)}</td>
                        <td className="py-2">{d.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* KPI Cards — from daily report (encaissements) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Taux d'occupation"
          value={`${occupancyRate}%`}
          subtitle={`${occupied} / ${totalRooms} chambres`}
          icon={BedDouble}
          color="sage"
        />
        <StatCard
          title="Encaissements"
          value={formatCurrency(daily?.totalEncaisse || 0)}
          subtitle={`${daily?.totalOrders || 0} commande(s)${daily?.voucherCount > 0 ? ` · ${daily?.voucherCount} bon(s) : ${formatCurrency(daily?.voucherTotal || 0)}` : ''}`}
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
        <StatCard
          title="Commandes annulées"
          value={cancelledCount}
          subtitle={`sur ${orderList.length} au total`}
          icon={UtensilsCrossed}
          color="red"
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
                <p className="text-sm text-sage-600">CA des commandes (hors bons)</p>
                <p className="text-2xl font-bold text-sage-800">{formatCurrency(totalRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-sage-400" />
            </div>
            {voucherOrders.length > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div>
                  <p className="text-sm text-amber-700">Bons Propriétaire ({voucherOrders.length})</p>
                  <p className="text-2xl font-bold text-amber-800">{formatCurrency(voucherTotal)}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Exclu du CA — comptabilisé au bilan</p>
                </div>
              </div>
            )}
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

      {/* ═══════════ CAISSE (Cash Register) ═══════════ */}
      <div className="card-accent p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display text-sm font-bold text-wood-700 flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Rapport de caisse
          </h4>
          <button onClick={() => exportCSV('caisse')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            Exporter CSV
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-4 mb-4">
          <div className="rounded-lg bg-sage-50/50 border border-sage-200 p-4 text-center">
            <p className="text-2xl font-bold text-sage-800">{formatCurrency(totalCaisse)}</p>
            <p className="text-xs text-sage-600 mt-1">Total encaissé</p>
          </div>
          {caisseData.map((c, i) => (
            <div key={i} className="rounded-lg bg-wood-50 border border-wood-200 p-4 text-center">
              <p className="text-xl font-bold text-wood-800">{formatCurrency(c.value)}</p>
              <p className="text-xs text-wood-600 mt-1">{c.name} ({c.count})</p>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={caisseData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9C8B7E' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9C8B7E' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Bar dataKey="value" name="Montant" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ═══════════ STOCK ═══════════ */}
      <div className="card-accent p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display text-sm font-bold text-wood-700 flex items-center gap-2">
            <Package className="h-4 w-4" /> État du stock
          </h4>
          <button onClick={() => exportCSV('stock')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            Exporter CSV
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div className="rounded-lg bg-accent-50/50 border border-accent-200 p-4 text-center">
            <p className="text-2xl font-bold text-accent-800">{articleList.length}</p>
            <p className="text-xs text-accent-600 mt-1">Articles en catalogue</p>
          </div>
          <div className="rounded-lg bg-sage-50/50 border border-sage-200 p-4 text-center">
            <p className="text-2xl font-bold text-sage-800">{formatCurrency(totalStockValue)}</p>
            <p className="text-xs text-sage-600 mt-1">Valeur totale du stock</p>
          </div>
          <div className="rounded-lg bg-primary-50/50 border border-primary-200 p-4 text-center">
            <p className="text-2xl font-bold text-primary-800">{stockAlerts.length}</p>
            <p className="text-xs text-primary-600 mt-1">Alertes stock bas</p>
          </div>
        </div>

        {stockCategoryData.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={stockCategoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="count"
                  label={({ name, count }) => `${name}: ${count}`}
                >
                  {stockCategoryData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RechartsPieChart>
            </ResponsiveContainer>

            {stockAlerts.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-primary-700 mb-2">Articles en stock bas</h5>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {stockAlerts.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded bg-primary-50 border border-primary-100 px-3 py-2 text-sm">
                      <span className="font-medium text-primary-800">{a.name}</span>
                      <span className="text-primary-600">{a.currentStock} / {a.minimumStock} {a.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ ACHATS (Purchases) ═══════════ */}
      {isDAF && (
        <div className="card-accent p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display text-sm font-bold text-wood-700 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Rapport des achats
            </h4>
            <button onClick={() => exportCSV('purchases')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              Exporter CSV
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-lg bg-primary-50/50 border border-primary-200 p-4 text-center">
              <p className="text-2xl font-bold text-primary-800">{formatCurrency(totalPurchasesCost)}</p>
              <p className="text-xs text-primary-600 mt-1">Total des achats</p>
            </div>
            <div className="rounded-lg bg-accent-50/50 border border-accent-200 p-4 text-center">
              <p className="text-2xl font-bold text-accent-800">{purchases.length}</p>
              <p className="text-xs text-accent-600 mt-1">Mouvements d'achat</p>
            </div>
            <div className="rounded-lg bg-sage-50/50 border border-sage-200 p-4 text-center">
              <p className="text-2xl font-bold text-sage-800">{purchasesChartData.length}</p>
              <p className="text-xs text-sage-600 mt-1">Articles approvisionnés</p>
            </div>
          </div>

          {purchasesChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={purchasesChartData.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E8D1" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9C8B7E' }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: '#9C8B7E' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number, name: string) => [name === 'cost' ? formatCurrency(value) : value, name === 'cost' ? 'Coût' : 'Quantité']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="quantity" name="Quantité" fill={COLORS.sage} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Coût" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Article</th><th>Quantité achetée</th><th>Coût total</th></tr>
                    </thead>
                    <tbody>
                      {purchasesChartData.map((p, i) => (
                        <tr key={i}>
                          <td className="font-medium text-gray-900">{p.name}</td>
                          <td className="font-semibold">{p.quantity}</td>
                          <td className="font-semibold text-primary-700">{formatCurrency(p.cost)}</td>
                        </tr>
                      ))}
                      <tr className="bg-wood-50 font-bold">
                        <td>Total</td>
                        <td>{purchasesChartData.reduce((s, x) => s + x.quantity, 0)}</td>
                        <td className="text-primary-700">{formatCurrency(totalPurchasesCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-wood-400 py-8">Aucun achat enregistré</p>
          )}
        </div>
      )}
    </div>
  );
}
