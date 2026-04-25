'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { UtensilsCrossed, Plus, Loader2, BarChart3, QrCode, X, CheckCircle2, FileDown, AlertTriangle, Copy, Wallet, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, formatCurrency, statusLabels } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { api } from '@/lib/api';
import { Order, OrderStatus, PaymentMethod } from '@/types';

const CASHIN_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'MOOV_MONEY' as PaymentMethod, label: 'Flooz' },
  { value: 'MIXX_BY_YAS' as PaymentMethod, label: 'Yas' },
  { value: 'CARD', label: 'Carte bancaire' },
  { value: 'FEDAPAY' as PaymentMethod, label: 'FedaPay' },
  { value: 'BANK_TRANSFER', label: 'Virement' },
  { value: 'OTHER' as PaymentMethod, label: 'Autre' },
];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const canCreate = isSuperAdmin || ['OWNER', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS'].includes(currentEstRole || '');
  const canDownloadReceipt = isSuperAdmin || ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS'].includes(currentEstRole || '');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [serverFilter, setServerFilter] = useState('');
  const [myOrdersOnly, setMyOrdersOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const canManageDuplicates = isSuperAdmin || ['OWNER', 'DAF', 'MANAGER'].includes(currentEstRole || '');
  const isDAFOrManager = isSuperAdmin || ['DAF', 'MANAGER'].includes(currentEstRole || '');

  const [form, setForm] = useState({ establishmentId: '', tableNumber: '', orderType: 'RESTAURANT' as 'RESTAURANT' | 'LEISURE' | 'LOCATION', items: [{ articleId: '', quantity: 1 }] as Array<{ articleId: string; quantity: number }>, notes: '', startTime: '', endTime: '', isVoucher: false, voucherOwnerId: '', voucherOwnerName: '', discountRuleId: '', serverId: '', operationDate: '' });
  const isPOS = currentEstRole === 'POS';
  const [qrModal, setQrModal] = useState<{ open: boolean; invoiceId?: string; qrCode?: string; invoiceNumber?: string; totalAmount?: number; paymentLabel?: string; currency?: string; paid?: boolean; fedapayCheckoutUrl?: string }>({ open: false });
  const [cashInModal, setCashInModal] = useState<{ open: boolean; order?: Order; method: PaymentMethod; paidAt: string }>({ open: false, method: 'CASH', paidAt: '' });
  const canBackdateBeyondCap = isSuperAdmin || ['OWNER', 'DAF', 'MANAGER'].includes(currentEstRole || '');
  const [addItemsModal, setAddItemsModal] = useState<{ open: boolean; order?: Order; items: Array<{ articleId: string; quantity: number }> }>({ open: false, items: [{ articleId: '', quantity: 1 }] });

  // Fetch users (servers) for filter — only for DAF/Manager
  const { data: usersData } = useQuery({
    queryKey: ['users-servers'],
    queryFn: () => apiGet<any>('/users?limit=100'),
    enabled: isDAFOrManager,
  });

  // forUserId matches createdById OR serverId so servers see POS-entered orders attributed to them.
  const effectiveForUserId = myOrdersOnly ? currentUser?.id : serverFilter;
  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, statusFilter, effectiveForUserId, currentEstId],
    queryFn: () => apiGet<any>(`/orders?page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}${effectiveForUserId ? `&forUserId=${effectiveForUserId}` : ''}${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
    refetchInterval: 15000,
  });

  const { data: articlesData } = useQuery({
    queryKey: ['articles-menu', currentEstId],
    queryFn: () => apiGet<any>(`/articles?limit=200&menuOnly=true${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });

  const { data: tablesData } = useQuery({
    queryKey: ['restaurant-tables', currentEstId],
    queryFn: () => apiGet<any>(`/restaurant-tables${currentEstId ? `?establishmentId=${currentEstId}` : ''}`),
  });

  const { data: statsData } = useQuery({
    queryKey: ['order-stats', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/orders/stats/${currentEstId}`) : null,
    enabled: !!currentEstId,
  });

  const { data: ownersData } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiGet<any>('/users/owners'),
    enabled: form.isVoucher,
  });

  const { data: discountRulesData } = useQuery({
    queryKey: ['discount-rules-order'],
    queryFn: () => apiGet<any>('/discount-rules?appliesTo=ORDER&isActive=true'),
  });
  const discountRules: any[] = discountRulesData?.data || [];

  // Servers list (for POS attribution) — only fetched when a POS user is creating an order
  const { data: serversData } = useQuery({
    queryKey: ['establishment-servers', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/establishments/${currentEstId}/servers`) : null,
    enabled: isPOS && !!currentEstId && showModal,
  });
  const servers: Array<{ id: string; firstName: string; lastName: string; role: string }> = serversData?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<any>('/orders', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      setShowModal(false);
      resetForm();
      toast.success('Commande créée — encaissement à faire au moment du paiement');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const addItemsMutation = useMutation({
    mutationFn: ({ id, items }: { id: string; items: Array<{ articleId: string; quantity: number }> }) =>
      apiPost<any>(`/orders/${id}/items`, { items, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      setAddItemsModal({ open: false, items: [{ articleId: '', quantity: 1 }] });
      toast.success(`${res?.data?.addedCount || 0} article(s) ajouté(s) — cuisine notifiée`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de l\'ajout'),
  });

  const cashInMutation = useMutation({
    mutationFn: ({ id, method, paidAt }: { id: string; method: PaymentMethod; paidAt?: string }) =>
      apiPost<any>(`/orders/${id}/cashin`, { method, ...(paidAt ? { paidAt } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCashInModal({ open: false, method: 'CASH', paidAt: '' });
      toast.success('Encaissement enregistré — commande servie');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur encaissement'),
  });

  // Poll invoice payment status when QR modal is open (FedaPay confirmation)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (qrModal.open && qrModal.invoiceId && !qrModal.paid) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await apiGet<any>(`/invoices/${qrModal.invoiceId}/payment-status`);
          if (res?.data?.paid) {
            setQrModal((prev) => ({ ...prev, paid: true }));
            toast.success('Paiement reçu !');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['order-stats'] });
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch {}
      }, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [qrModal.open, qrModal.invoiceId, qrModal.paid]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => apiPatch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      toast.success('Statut mis à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const [voucherModal, setVoucherModal] = useState<{
    open: boolean;
    orderId?: string;
    orderNumber?: string;
    isVoucher: boolean;
    voucherOwnerId: string;
    voucherOwnerName: string;
  }>({ open: false, isVoucher: false, voucherOwnerId: '', voucherOwnerName: '' });

  const updateVoucherMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { isVoucher: boolean; voucherOwnerId?: string | null; voucherOwnerName?: string | null } }) =>
      apiPatch(`/orders/${id}/voucher`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      setVoucherModal({ open: false, isVoucher: false, voucherOwnerId: '', voucherOwnerName: '' });
      toast.success('Statut bon propriétaire mis à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const canEditVoucher = isSuperAdmin || ['OWNER', 'DAF', 'MANAGER'].includes(currentEstRole || '');

  const { data: voucherOwnersData } = useQuery({
    queryKey: ['voucher-owners'],
    queryFn: () => apiGet<any>('/users/owners'),
    enabled: canEditVoucher && voucherModal.open,
  });
  const owners: Array<{ id: string; firstName?: string; lastName?: string; name: string }> = voucherOwnersData?.data || ownersData?.data || [];

  const downloadReceipt = async (orderId: string, orderNumber: string) => {
    try {
      const res = await api.get(`/orders/${orderId}/receipt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `recu-${orderNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement du reçu');
    }
  };

  const resetForm = () => setForm({ establishmentId: currentEstId || '', tableNumber: '', orderType: 'RESTAURANT', items: [{ articleId: '', quantity: 1 }], notes: '', startTime: '', endTime: '', isVoucher: false, voucherOwnerId: '', voucherOwnerName: '', discountRuleId: '', serverId: '', operationDate: '' });

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { articleId: '', quantity: 1 }] }));
  const removeItem = (idx: number) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  // Duplicate detection
  const { data: duplicatesData, isLoading: isLoadingDuplicates, refetch: refetchDuplicates } = useQuery({
    queryKey: ['order-duplicates', currentEstId],
    queryFn: () => apiGet<any>(`/orders/duplicates${currentEstId ? `?establishmentId=${currentEstId}` : ''}`),
    enabled: showDuplicates && canManageDuplicates,
  });

  const cancelDuplicatesMutation = useMutation({
    mutationFn: (orderIds: string[]) => apiPost<any>('/orders/duplicates/cancel', { orderIds }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      refetchDuplicates();
      toast.success(`${res?.data?.cancelled || 0} doublon(s) annulé(s)`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const articles = articlesData?.data || [];
  const orders = data?.data || [];
  const meta = data?.meta;
  const stats = statsData?.data;

  const getNextStatuses = (current: OrderStatus): Array<{ status: OrderStatus; label: string; color: string }> => {
    switch (current) {
      case 'PENDING': return [
        { status: 'IN_PROGRESS', label: 'En préparation', color: 'text-blue-600' },
        { status: 'CANCELLED', label: 'Annuler', color: 'text-red-600' },
      ];
      case 'IN_PROGRESS': return [
        { status: 'READY', label: 'Prête', color: 'text-green-600' },
        { status: 'CANCELLED', label: 'Annuler', color: 'text-red-600' },
      ];
      case 'READY': return [
        { status: 'SERVED', label: 'Servie', color: 'text-gray-600' },
      ];
      default: return [];
    }
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes"
        subtitle={`${meta?.total || 0} commande${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            {stats && (
              <button onClick={() => setShowStats(!showStats)} className="btn-secondary">
                <BarChart3 className="mr-2 h-4 w-4" /> Stats
              </button>
            )}
            {canManageDuplicates && (
              <button onClick={() => setShowDuplicates(true)} className="btn-secondary text-amber-700 border-amber-300 hover:bg-amber-50">
                <Copy className="mr-2 h-4 w-4" /> Doublons
              </button>
            )}
            {canCreate && (
              <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary">
                <Plus className="mr-2 h-4 w-4" /> Nouvelle commande
              </button>
            )}
          </div>
        }
      />

      {/* Stats panel */}
      {showStats && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.today}</p>
            <p className="text-sm text-gray-500">Aujourd'hui</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.thisWeek}</p>
            <p className="text-sm text-gray-500">Cette semaine</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
            <p className="text-sm text-gray-500">Ce mois</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-full sm:w-48">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="IN_PROGRESS">En cours</option>
          <option value="READY">Prête</option>
          <option value="SERVED">Servie</option>
          <option value="CANCELLED">Annulée</option>
        </select>
        <button
          onClick={() => { setMyOrdersOnly(!myOrdersOnly); setServerFilter(''); setPage(1); }}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${myOrdersOnly ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          Mes commandes
        </button>
        {isDAFOrManager && !myOrdersOnly && (
          <select value={serverFilter} onChange={(e) => { setServerFilter(e.target.value); setPage(1); }} className="input w-full sm:w-56">
            <option value="">Tous les serveurs</option>
            {(usersData?.data || []).map((u: any) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        )}
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="Aucune commande" description="Créez votre première commande" />
      ) : (
        <>
          {/* Desktop table — hidden on mobile */}
          <div className="card hidden lg:block">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>N° Commande</th>
                    <th>Table</th>
                    <th>Articles</th>
                    <th>Total</th>
                    <th>Statut</th>
                    <th>Paiement</th>
                    <th>Créée par</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: Order) => (
                    <tr key={order.id}>
                      <td className="font-medium text-gray-900">
                        {order.orderNumber}
                        {order.orderType === 'LEISURE' && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">Loisir</span>
                        )}
                        {order.orderType === 'LOCATION' && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Location</span>
                        )}
                        {(order as any).isVoucher && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Bon{(order as any).voucherOwnerName ? ` — ${(order as any).voucherOwnerName}` : ''}</span>
                        )}
                      </td>
                      <td className="text-gray-500">{order.tableNumber || '-'}</td>
                      <td className="text-sm text-gray-600">
                        {order.items?.map((item) => (
                          <div key={item.id}>{item.quantity}x {item.article?.name || item.articleId}</div>
                        ))}
                        {order.notes && (
                          <div className="mt-1 text-xs text-primary-600 italic bg-primary-50 rounded px-1.5 py-0.5">
                            {order.notes}
                          </div>
                        )}
                      </td>
                      <td className="font-medium">{formatCurrency(order.totalAmount)}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className="text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600">
                            {order.paymentMethod === 'MOOV_MONEY' ? 'Flooz' : order.paymentMethod === 'MIXX_BY_YAS' ? 'Yas' : order.paymentMethod === 'FEDAPAY' ? 'FedaPay' : order.paymentMethod || '-'}
                          </span>
                          {order.invoiceId && (
                            <button
                              onClick={async () => {
                                try {
                                  const qrRes = await apiGet<any>(`/invoices/${order.invoiceId}/qrcode`);
                                  if (qrRes?.data) {
                                    setQrModal({
                                      open: true,
                                      invoiceId: order.invoiceId!,
                                      qrCode: qrRes.data.qrCode,
                                      invoiceNumber: qrRes.data.invoice?.invoiceNumber,
                                      totalAmount: qrRes.data.invoice?.totalAmount,
                                      paymentLabel: qrRes.data.paymentLabel,
                                      currency: qrRes.data.invoice?.currency || 'XOF',
                                      fedapayCheckoutUrl: qrRes.data.fedapayCheckoutUrl,
                                    });
                                  }
                                } catch {
                                  toast.error('QR code indisponible');
                                }
                              }}
                              className="btn-ghost p-1 text-primary-600 hover:text-primary-700"
                              title="Afficher QR code de paiement"
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                          )}
                          {canDownloadReceipt && (
                            <button
                              onClick={() => downloadReceipt(order.id, order.orderNumber)}
                              className="btn-ghost p-1 text-gray-600 hover:text-gray-800"
                              title="Télécharger le reçu PDF"
                            >
                              <FileDown className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="text-gray-500 text-sm">
                        {order.server && order.server.id !== order.createdBy?.id ? (
                          <div>
                            <div className="text-gray-800">{order.server.firstName} {order.server.lastName}</div>
                            <div className="text-xs text-gray-400">Saisie: {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}</div>
                          </div>
                        ) : (
                          order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'
                        )}
                      </td>
                      <td className="text-gray-500 text-xs">
                        <div className="text-gray-700">
                          {formatDateTime((order as any).operationDate || order.createdAt)}
                        </div>
                        {(order as any).operationDate &&
                          new Date((order as any).operationDate).toISOString().slice(0, 10) !==
                            new Date(order.createdAt).toISOString().slice(0, 10) && (
                            <div className="text-[10px] italic text-amber-600" title="Saisie rétroactive">
                              saisi le {formatDateTime(order.createdAt)}
                            </div>
                          )}
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {order.status !== 'SERVED' && order.status !== 'CANCELLED' && canCreate && (
                            <button
                              onClick={() => setAddItemsModal({ open: true, order, items: [{ articleId: '', quantity: 1 }] })}
                              className="btn-ghost text-xs px-2 py-1 text-primary-600 font-medium"
                              title="Ajouter des articles à cette commande"
                            >
                              <PlusCircle className="h-3.5 w-3.5 mr-1 inline" /> Ajouter
                            </button>
                          )}
                          {order.invoiceId && order.status !== 'SERVED' && order.status !== 'CANCELLED' && (
                            <button
                              onClick={() => setCashInModal({ open: true, order, method: 'CASH', paidAt: '' })}
                              className="btn-ghost text-xs px-2 py-1 text-red-600 font-medium"
                              title="Enregistrer le paiement et marquer Servie"
                            >
                              <Wallet className="h-3.5 w-3.5 mr-1 inline" /> Encaisser
                            </button>
                          )}
                          {canEditVoucher && order.status !== 'CANCELLED' && (
                            <button
                              onClick={() => setVoucherModal({
                                open: true,
                                orderId: order.id,
                                orderNumber: order.orderNumber,
                                isVoucher: !!(order as any).isVoucher,
                                voucherOwnerId: (order as any).voucherOwnerId || '',
                                voucherOwnerName: (order as any).voucherOwnerName || '',
                              })}
                              className="btn-ghost text-xs px-2 py-1 text-amber-700 font-medium"
                              title="Modifier le statut bon propriétaire"
                            >
                              {(order as any).isVoucher ? 'Retirer bon' : 'Bon ?'}
                            </button>
                          )}
                          {getNextStatuses(order.status).filter((action) => {
                            if (isSuperAdmin) return true;
                            const role = currentEstRole;
                            if (role === 'COOK') return ['IN_PROGRESS', 'READY'].includes(action.status);
                            if (role === 'SERVER') return action.status === 'SERVED';
                            if (role === 'MANAGER' || role === 'DAF') return action.status === 'CANCELLED';
                            return false;
                          }).map((action) => (
                            <button
                              key={action.status}
                              onClick={() => updateStatusMutation.mutate({ id: order.id, status: action.status })}
                              className={`btn-ghost text-xs px-2 py-1 ${action.color}`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
          </div>

          {/* Mobile card layout — hidden on desktop */}
          <div className="lg:hidden space-y-3">
            {orders.map((order: Order) => (
              <div key={order.id} className="card p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                    {order.orderType === 'LEISURE' && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">Loisir</span>
                    )}
                    {order.orderType === 'LOCATION' && (
                      <span className="inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Location</span>
                    )}
                    {(order as any).isVoucher && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Bon{(order as any).voucherOwnerName ? ` — ${(order as any).voucherOwnerName}` : ''}</span>
                    )}
                    <StatusBadge status={order.status} />
                  </div>
                  <span className="font-bold text-gray-900">{formatCurrency(order.totalAmount)}</span>
                </div>

                {/* Articles */}
                <div className="text-sm text-gray-600">
                  {order.items?.map((item) => (
                    <span key={item.id} className="inline-block mr-2">{item.quantity}x {item.article?.name || item.articleId}</span>
                  ))}
                </div>

                {order.notes && (
                  <div className="text-xs text-primary-600 italic bg-primary-50 rounded px-2 py-1">{order.notes}</div>
                )}

                {/* Meta row */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    {order.tableNumber && <span className="bg-gray-100 rounded px-1.5 py-0.5">Table {order.tableNumber}</span>}
                    <span>{order.paymentMethod === 'MOOV_MONEY' ? 'Flooz' : order.paymentMethod === 'MIXX_BY_YAS' ? 'Yas' : order.paymentMethod === 'FEDAPAY' ? 'FedaPay' : order.paymentMethod || '-'}</span>
                  </div>
                  <div className="text-right">
                    <div>{formatDateTime((order as any).operationDate || order.createdAt)}</div>
                    {(order as any).operationDate &&
                      new Date((order as any).operationDate).toISOString().slice(0, 10) !==
                        new Date(order.createdAt).toISOString().slice(0, 10) && (
                        <div className="text-[10px] italic text-amber-600">
                          saisi le {formatDateTime(order.createdAt)}
                        </div>
                      )}
                  </div>
                </div>

                {order.server && order.server.id !== order.createdBy?.id ? (
                  <div className="text-xs text-gray-500">
                    Serveur <span className="font-medium text-gray-700">{order.server.firstName} {order.server.lastName}</span>
                    {order.createdBy && <span className="text-gray-400"> — saisie par {order.createdBy.firstName} {order.createdBy.lastName}</span>}
                  </div>
                ) : order.createdBy ? (
                  <div className="text-xs text-gray-400">Par {order.createdBy.firstName} {order.createdBy.lastName}</div>
                ) : null}

                {/* Actions row */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
                  {order.status !== 'SERVED' && order.status !== 'CANCELLED' && canCreate && (
                    <button
                      onClick={() => setAddItemsModal({ open: true, order, items: [{ articleId: '', quantity: 1 }] })}
                      className="btn-ghost text-xs px-2 py-1 text-primary-600 font-medium"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1 inline" /> Ajouter
                    </button>
                  )}
                  {order.invoiceId && order.status !== 'SERVED' && order.status !== 'CANCELLED' && (
                    <button
                      onClick={() => setCashInModal({ open: true, order, method: 'CASH', paidAt: '' })}
                      className="btn-ghost text-xs px-2 py-1 text-red-600 font-medium"
                    >
                      <Wallet className="h-3.5 w-3.5 mr-1 inline" /> Encaisser
                    </button>
                  )}
                  {order.invoiceId && (
                    <button
                      onClick={async () => {
                        try {
                          const qrRes = await apiGet<any>(`/invoices/${order.invoiceId}/qrcode`);
                          if (qrRes?.data) {
                            setQrModal({
                              open: true,
                              invoiceId: order.invoiceId!,
                              qrCode: qrRes.data.qrCode,
                              invoiceNumber: qrRes.data.invoice?.invoiceNumber,
                              totalAmount: qrRes.data.invoice?.totalAmount,
                              paymentLabel: qrRes.data.paymentLabel,
                              currency: qrRes.data.invoice?.currency || 'XOF',
                              fedapayCheckoutUrl: qrRes.data.fedapayCheckoutUrl,
                            });
                          }
                        } catch {
                          toast.error('QR code indisponible');
                        }
                      }}
                      className="btn-ghost text-xs px-2 py-1 text-primary-600"
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1 inline" /> QR
                    </button>
                  )}
                  {canDownloadReceipt && (
                    <button
                      onClick={() => downloadReceipt(order.id, order.orderNumber)}
                      className="btn-ghost text-xs px-2 py-1 text-gray-600"
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1 inline" /> Reçu
                    </button>
                  )}
                  {getNextStatuses(order.status).filter((action) => {
                    if (isSuperAdmin) return true;
                    const role = currentEstRole;
                    if (role === 'COOK') return ['IN_PROGRESS', 'READY'].includes(action.status);
                    if (role === 'SERVER') return action.status === 'SERVED';
                    if (role === 'MANAGER' || role === 'DAF') return action.status === 'CANCELLED';
                    return false;
                  }).map((action) => (
                    <button
                      key={action.status}
                      onClick={() => updateStatusMutation.mutate({ id: order.id, status: action.status })}
                      className={`btn-ghost text-xs px-2 py-1 ${action.color}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
          </div>
        </>
      )}

      {/* QR Code payment modal */}
      <Modal open={qrModal.open} onClose={() => setQrModal({ open: false })} title="QR Code de paiement" size="md">
        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-gray-900">Facture {qrModal.invoiceNumber}</p>
            <p className="text-2xl font-bold text-primary-700">{formatCurrency(qrModal.totalAmount || 0)} {qrModal.currency}</p>
            <p className="text-sm text-gray-500">Paiement par <span className="font-medium text-gray-700">{qrModal.paymentLabel}</span></p>
          </div>
          {qrModal.qrCode && (
            <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-primary-100">
              <img src={qrModal.qrCode} alt="QR Code de paiement" className="w-64 h-64" />
            </div>
          )}
          {qrModal.fedapayCheckoutUrl ? (
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Scannez le QR code ou cliquez sur le bouton ci-dessous pour payer via FedaPay.
            </p>
          ) : (
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Le client doit scanner ce QR code avec son application {qrModal.paymentLabel} pour effectuer le paiement.
            </p>
          )}
          {qrModal.paid ? (
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3 w-full justify-center">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Paiement reçu !</span>
              </div>
              <button onClick={() => { setQrModal({ open: false }); queryClient.invalidateQueries({ queryKey: ['orders'] }); queryClient.invalidateQueries({ queryKey: ['invoices'] }); }} className="btn-primary w-full">
                Fermer
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {qrModal.fedapayCheckoutUrl && (
                <>
                  <a
                    href={qrModal.fedapayCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary bg-blue-600 hover:bg-blue-700 w-full text-center flex items-center justify-center gap-2"
                  >
                    💳 Payer avec FedaPay
                  </a>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 w-full">
                    <p className="text-xs text-gray-500 mb-1 text-center">Lien de paiement :</p>
                    <a
                      href={qrModal.fedapayCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline break-all block text-center"
                    >
                      {qrModal.fedapayCheckoutUrl}
                    </a>
                  </div>
                </>
              )}
              <button
                onClick={async () => {
                  try {
                    await apiPost(`/invoices/${qrModal.invoiceId}/simulate-payment`, {});
                    setQrModal((prev) => ({ ...prev, paid: true }));
                    queryClient.invalidateQueries({ queryKey: ['orders'] });
                    queryClient.invalidateQueries({ queryKey: ['invoices'] });
                    queryClient.invalidateQueries({ queryKey: ['order-stats'] });
                    toast.success('Paiement simulé avec succès !');
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Erreur simulation paiement');
                  }
                }}
                className="btn-primary bg-green-600 hover:bg-green-700 w-full"
              >
                Simuler le paiement client
              </button>
              <button onClick={() => setQrModal({ open: false })} className="btn-secondary w-full">
                Fermer
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Create order modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle commande" size="lg">
        <form onSubmit={(e) => {
          e.preventDefault();
          const body = {
            establishmentId: form.establishmentId || currentEstId,
            idempotencyKey: crypto.randomUUID(),
            tableNumber: form.tableNumber || undefined,
            orderType: form.orderType,
            items: form.items.filter((i) => i.articleId),
            notes: form.notes || undefined,
            startTime: (form.orderType === 'LEISURE' || form.orderType === 'LOCATION') && form.startTime ? new Date(form.startTime).toISOString() : undefined,
            endTime: (form.orderType === 'LEISURE' || form.orderType === 'LOCATION') && form.endTime ? new Date(form.endTime).toISOString() : undefined,
            isVoucher: form.isVoucher || undefined,
            voucherOwnerId: form.isVoucher && form.voucherOwnerId ? form.voucherOwnerId : undefined,
            voucherOwnerName: form.isVoucher && form.voucherOwnerName ? form.voucherOwnerName : undefined,
            discountRuleId: !form.isVoucher && form.discountRuleId ? form.discountRuleId : undefined,
            serverId: isPOS && form.serverId ? form.serverId : undefined,
            operationDate: form.operationDate ? new Date(form.operationDate).toISOString() : undefined,
          };
          createMutation.mutate(body);
        }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Type</label>
              <select value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value as any })} className="input">
                <option value="RESTAURANT">Restaurant</option>
                <option value="LEISURE">Loisir</option>
                <option value="LOCATION">Location</option>
              </select>
            </div>
            <div>
              <label className="label">Table (optionnel)</label>
              <select value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} className="input">
                <option value="">— Sans table —</option>
                {(tablesData?.data || []).map((t: any) => (
                  <option key={t.id} value={t.number}>{t.number}{t.label ? ` — ${t.label}` : ''} ({t.capacity} places)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Notes (optionnel)</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Instructions spéciales..." />
            </div>
            {(() => {
              const minDays = canBackdateBeyondCap ? 365 : 15;
              const minDate = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
              const maxDate = new Date().toISOString().slice(0, 16);
              return (
                <div>
                  <label className="label">Date de l'opération (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={form.operationDate}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => setForm({ ...form, operationDate: e.target.value })}
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Laissez vide pour aujourd'hui. {canBackdateBeyondCap ? 'Rétrodatage illimité (superviseur).' : 'Rétrodatage limité à 15 jours.'}
                  </p>
                </div>
              );
            })()}
          </div>
          {isPOS && (
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
              <label className="label text-primary-900">Serveur attribué (optionnel)</label>
              <select
                value={form.serverId}
                onChange={(e) => setForm({ ...form, serverId: e.target.value })}
                className="input border-primary-300 focus:ring-primary-500"
              >
                <option value="">— Commande POS (sans serveur) —</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}{s.role === 'MAITRE_HOTEL' ? ' (Maître d\'hôtel)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-primary-700 mt-1">La commande sera attribuée au serveur sélectionné. Votre compte POS reste saisissant pour l&apos;audit.</p>
            </div>
          )}
          <p className="text-xs text-gray-500">Le moyen de paiement sera choisi au moment de l&apos;encaissement.</p>

          {/* Remise manuelle */}
          {!form.isVoucher && discountRules.length > 0 && (
            <div>
              <label className="label">Remise (optionnel)</label>
              <select
                value={form.discountRuleId}
                onChange={(e) => setForm({ ...form, discountRuleId: e.target.value })}
                className="input"
              >
                <option value="">Aucune remise</option>
                {discountRules.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.type === 'PERCENTAGE' ? `${Number(r.value)}%` : `${Math.round(Number(r.value)).toLocaleString('fr-FR')} FCFA`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bon Propriétaire */}
          <div className={`rounded-lg border p-3 ${form.isVoucher ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isVoucher} onChange={(e) => setForm({ ...form, isVoucher: e.target.checked, voucherOwnerId: '', voucherOwnerName: '' })} className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
              <div>
                <span className={`font-medium ${form.isVoucher ? 'text-amber-800' : 'text-gray-700'}`}>Bon Propriétaire</span>
                <span className="text-xs text-gray-500 ml-2">Exclu du CA — comptabilisé au bilan</span>
              </div>
            </label>
            {form.isVoucher && (
              <div className="mt-3">
                <label className="label text-amber-800">Propriétaire</label>
                <select
                  value={form.voucherOwnerId}
                  onChange={(e) => {
                    const owner = (ownersData?.data || []).find((o: any) => o.id === e.target.value);
                    setForm({ ...form, voucherOwnerId: e.target.value, voucherOwnerName: owner?.name || '' });
                  }}
                  className="input border-amber-300 focus:ring-amber-500"
                >
                  <option value="">— Sélectionner le propriétaire —</option>
                  {(ownersData?.data || []).map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {(form.orderType === 'LEISURE' || form.orderType === 'LOCATION') && (
            <div className={`grid grid-cols-2 gap-4 rounded-lg border p-3 ${form.orderType === 'LEISURE' ? 'bg-purple-50 border-purple-200' : 'bg-teal-50 border-teal-200'}`}>
              <div>
                <label className="label">{form.orderType === 'LOCATION' ? 'Date/heure début' : 'Heure de début'} (optionnel)</label>
                <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">{form.orderType === 'LOCATION' ? 'Date/heure fin' : 'Heure de fin'} (optionnel)</label>
                <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="input" />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Articles</label>
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700">+ Ajouter un article</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.articleId}
                    onChange={(e) => updateItem(idx, 'articleId', e.target.value)}
                    className="input flex-1"
                    required
                  >
                    <option value="">Sélectionner un article</option>
                    {Object.entries(
                      articles.reduce((acc: Record<string, any[]>, a: any) => {
                        const cat = a.category?.name || 'Sans catégorie';
                        (acc[cat] ||= []).push(a);
                        return acc;
                      }, {})
                    )
                      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
                      .map(([catName, items]) => (
                        <optgroup key={catName} label={catName}>
                          {(items as any[]).map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.unitPrice)}</option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="input w-20"
                  />
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="btn-ghost text-red-500 p-1.5">x</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer la commande
            </button>
          </div>
        </form>
      </Modal>

      {/* Duplicates detection modal */}
      <Modal open={showDuplicates} onClose={() => setShowDuplicates(false)} title="Détection des doublons" size="lg">
        <div className="space-y-4">
          {isLoadingDuplicates ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
          ) : !duplicatesData?.data?.duplicateGroups?.length ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Aucun doublon détecté</p>
              <p className="text-sm mt-1">Toutes les commandes sont uniques.</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">
                    {duplicatesData.data.summary.totalDuplicateOrders} doublon(s) détecté(s) dans {duplicatesData.data.summary.totalGroups} groupe(s)
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Montant total des doublons : {formatCurrency(duplicatesData.data.summary.totalDuplicateAmount)}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Critères : mêmes articles, mêmes quantités, même créateur, créées à moins de 2 min d&apos;intervalle.
                  </p>
                </div>
              </div>

              {/* Groups */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {duplicatesData.data.duplicateGroups.map((group: any, idx: number) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">
                          Original : <span className="text-green-700">{group.original.orderNumber}</span>
                          {group.original.tableNumber && <span className="text-gray-500"> — Table {group.original.tableNumber}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(group.original.totalAmount)} · {group.original.itemCount} article(s) · {formatDateTime(group.original.createdAt)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Par {group.original.createdBy?.firstName} {group.original.createdBy?.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {group.duplicates.map((dup: any) => (
                        <div key={dup.id} className="flex justify-between items-center bg-red-50 rounded px-2 py-1 text-sm">
                          <span className="text-red-700 font-medium">{dup.orderNumber}</span>
                          <span className="text-red-600 text-xs">{formatCurrency(dup.totalAmount)} · {formatDateTime(dup.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const ids = group.duplicates.map((d: any) => d.id);
                        if (confirm(`Annuler ${ids.length} doublon(s) de ${group.original.orderNumber} ? L'original sera conservé.`)) {
                          cancelDuplicatesMutation.mutate(ids);
                        }
                      }}
                      disabled={cancelDuplicatesMutation.isPending}
                      className="mt-2 text-xs btn-ghost text-red-600 hover:bg-red-50 px-2 py-1"
                    >
                      Annuler ces doublons
                    </button>
                  </div>
                ))}
              </div>

              {/* Cancel all */}
              <div className="flex justify-between items-center pt-2 border-t">
                <p className="text-sm text-gray-500">
                  Total à récupérer : <span className="font-bold text-red-600">{formatCurrency(duplicatesData.data.summary.totalDuplicateAmount)}</span>
                </p>
                <button
                  onClick={() => {
                    const allIds = duplicatesData.data.duplicateGroups.flatMap((g: any) => g.duplicates.map((d: any) => d.id));
                    if (confirm(`Annuler tous les ${allIds.length} doublon(s) ? Les commandes originales seront conservées.`)) {
                      cancelDuplicatesMutation.mutate(allIds);
                    }
                  }}
                  disabled={cancelDuplicatesMutation.isPending}
                  className="btn-primary bg-red-600 hover:bg-red-700"
                >
                  {cancelDuplicatesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Annuler tous les doublons
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Cash-in modal — choose payment method and confirm */}
      <Modal open={cashInModal.open} onClose={() => setCashInModal({ open: false, method: 'CASH', paidAt: '' })} title="Encaisser la commande" size="md">
        <div className="space-y-4">
          {cashInModal.order && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-gray-900">
                {cashInModal.order.orderNumber}
                {cashInModal.order.tableNumber && <span className="text-gray-500"> — Table {cashInModal.order.tableNumber}</span>}
              </p>
              <p className="text-lg font-bold text-primary-700 mt-1">{formatCurrency(cashInModal.order.totalAmount)}</p>
            </div>
          )}
          <div>
            <p className="label mb-2">Moyen de paiement</p>
            <div className="grid grid-cols-2 gap-2">
              {CASHIN_METHODS.map((m) => (
                <label
                  key={m.value}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    cashInModal.method === m.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cashInMethod"
                    value={m.value}
                    checked={cashInModal.method === m.value}
                    onChange={() => setCashInModal((prev) => ({ ...prev, method: m.value }))}
                    className="h-4 w-4 text-primary-600"
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Backdated payment date (accounting catch-up) */}
          {(() => {
            const minDays = canBackdateBeyondCap ? 365 : 15;
            const minDate = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
            const maxDate = new Date().toISOString().slice(0, 16);
            const backdated = cashInModal.paidAt && new Date(cashInModal.paidAt).getTime() < Date.now() - 24 * 60 * 60 * 1000;
            return (
              <div>
                <label className="label">Date du paiement (laisser vide = maintenant)</label>
                <input
                  type="datetime-local"
                  value={cashInModal.paidAt}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setCashInModal((prev) => ({ ...prev, paidAt: e.target.value }))}
                  className="input"
                />
                {backdated && (
                  <p className="text-xs text-amber-700 mt-1">
                    ⓘ Paiement rétrodaté — apparaîtra à cette date dans les rapports comptables.
                  </p>
                )}
                {!canBackdateBeyondCap && (
                  <p className="text-xs text-gray-500 mt-1">Limite : 15 jours en arrière. Au-delà, contactez un manager/DAF.</p>
                )}
              </div>
            );
          })()}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setCashInModal({ open: false, method: 'CASH', paidAt: '' })} className="btn-secondary">Annuler</button>
            <button
              type="button"
              onClick={() => {
                if (cashInModal.order) {
                  const paidAt = cashInModal.paidAt ? new Date(cashInModal.paidAt).toISOString() : undefined;
                  cashInMutation.mutate({ id: cashInModal.order.id, method: cashInModal.method, paidAt });
                }
              }}
              disabled={cashInMutation.isPending || !cashInModal.order}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              {cashInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer l&apos;encaissement
            </button>
          </div>
        </div>
      </Modal>

      {/* Voucher (bon propriétaire) edit modal */}
      <Modal
        open={voucherModal.open}
        onClose={() => setVoucherModal({ open: false, isVoucher: false, voucherOwnerId: '', voucherOwnerName: '' })}
        title="Bon propriétaire"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Commande <strong>{voucherModal.orderNumber}</strong>
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={voucherModal.isVoucher}
              onChange={(e) => setVoucherModal((prev) => ({
                ...prev,
                isVoucher: e.target.checked,
                voucherOwnerId: e.target.checked ? prev.voucherOwnerId : '',
                voucherOwnerName: e.target.checked ? prev.voucherOwnerName : '',
              }))}
              className="mt-0.5 h-4 w-4"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Cette commande est un bon propriétaire</div>
              <div className="text-xs text-gray-500">
                Activée → la commande nécessite l&apos;approbation d&apos;un OWNER. Désactivée → toute approbation pendante est rejetée.
              </div>
            </div>
          </label>

          {voucherModal.isVoucher && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500">Propriétaire</label>
                <select
                  value={voucherModal.voucherOwnerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const owner = owners.find((o) => o.id === id);
                    setVoucherModal((prev) => ({
                      ...prev,
                      voucherOwnerId: id,
                      voucherOwnerName: owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.name : '',
                    }));
                  }}
                  className="input mt-1 w-full"
                >
                  <option value="">— Sélectionner —</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {`${o.firstName || ''} ${o.lastName || ''}`.trim() || o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Nom affiché (optionnel)</label>
                <input
                  type="text"
                  value={voucherModal.voucherOwnerName}
                  onChange={(e) => setVoucherModal((prev) => ({ ...prev, voucherOwnerName: e.target.value }))}
                  className="input mt-1 w-full"
                  placeholder="Nom du propriétaire bénéficiaire"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setVoucherModal({ open: false, isVoucher: false, voucherOwnerId: '', voucherOwnerName: '' })}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                if (!voucherModal.orderId) return;
                if (voucherModal.isVoucher && !voucherModal.voucherOwnerId) {
                  toast.error('Sélectionnez un propriétaire');
                  return;
                }
                updateVoucherMutation.mutate({
                  id: voucherModal.orderId,
                  body: {
                    isVoucher: voucherModal.isVoucher,
                    voucherOwnerId: voucherModal.isVoucher ? voucherModal.voucherOwnerId : null,
                    voucherOwnerName: voucherModal.isVoucher ? (voucherModal.voucherOwnerName || null) : null,
                  },
                });
              }}
              disabled={updateVoucherMutation.isPending}
              className="btn-primary"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>

      {/* Add items modal — append articles to an open order */}
      <Modal open={addItemsModal.open} onClose={() => setAddItemsModal({ open: false, items: [{ articleId: '', quantity: 1 }] })} title="Ajouter des articles à la commande" size="lg">
        <div className="space-y-4">
          {addItemsModal.order && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-gray-900">
                {addItemsModal.order.orderNumber}
                {addItemsModal.order.tableNumber && <span className="text-gray-500"> — Table {addItemsModal.order.tableNumber}</span>}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Total actuel : <span className="font-medium text-gray-700">{formatCurrency(addItemsModal.order.totalAmount)}</span></p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Nouveaux articles</label>
              <button
                type="button"
                onClick={() => setAddItemsModal((prev) => ({ ...prev, items: [...prev.items, { articleId: '', quantity: 1 }] }))}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Ligne
              </button>
            </div>
            <div className="space-y-2">
              {addItemsModal.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.articleId}
                    onChange={(e) => setAddItemsModal((prev) => ({
                      ...prev,
                      items: prev.items.map((it, i) => i === idx ? { ...it, articleId: e.target.value } : it),
                    }))}
                    className="input flex-1"
                    required
                  >
                    <option value="">Sélectionner un article</option>
                    {Object.entries(
                      articles.reduce((acc: Record<string, any[]>, a: any) => {
                        const cat = a.category?.name || 'Sans catégorie';
                        (acc[cat] ||= []).push(a);
                        return acc;
                      }, {})
                    )
                      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
                      .map(([catName, catItems]) => (
                        <optgroup key={catName} label={catName}>
                          {(catItems as any[]).map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.unitPrice)}</option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.quantity}
                    onChange={(e) => setAddItemsModal((prev) => ({
                      ...prev,
                      items: prev.items.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it),
                    }))}
                    className="input w-20"
                  />
                  {addItemsModal.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAddItemsModal((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                      className="btn-ghost text-red-500 p-1.5"
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Les nouveaux articles seront envoyés en cuisine. Le total de la commande et la facture seront mis à jour.
              Impossible d&apos;ajouter si la facture a déjà reçu un paiement.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAddItemsModal({ open: false, items: [{ articleId: '', quantity: 1 }] })}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                if (!addItemsModal.order) return;
                const items = addItemsModal.items.filter((i) => i.articleId);
                if (items.length === 0) {
                  toast.error('Sélectionnez au moins un article');
                  return;
                }
                addItemsMutation.mutate({ id: addItemsModal.order.id, items });
              }}
              disabled={addItemsMutation.isPending || !addItemsModal.order}
              className="btn-primary"
            >
              {addItemsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter à la commande
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
