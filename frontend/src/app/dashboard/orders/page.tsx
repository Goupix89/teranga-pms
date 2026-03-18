'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { UtensilsCrossed, Plus, Loader2, BarChart3, QrCode, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, formatCurrency, statusLabels } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Order, OrderStatus, PaymentMethod } from '@/types';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const canCreate = isSuperAdmin || ['DAF', 'MANAGER', 'SERVER'].includes(currentEstRole || '');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [serverFilter, setServerFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isDAFOrManager = isSuperAdmin || ['DAF', 'MANAGER'].includes(currentEstRole || '');

  const [form, setForm] = useState({ establishmentId: '', tableNumber: '', paymentMethod: 'MOOV_MONEY' as PaymentMethod, items: [{ articleId: '', quantity: 1 }] as Array<{ articleId: string; quantity: number }>, notes: '' });
  const [qrModal, setQrModal] = useState<{ open: boolean; invoiceId?: string; qrCode?: string; invoiceNumber?: string; totalAmount?: number; paymentLabel?: string; currency?: string; paid?: boolean }>({ open: false });

  // Fetch users (servers) for filter — only for DAF/Manager
  const { data: usersData } = useQuery({
    queryKey: ['users-servers'],
    queryFn: () => apiGet<any>('/users?limit=100'),
    enabled: isDAFOrManager,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, statusFilter, serverFilter, currentEstId],
    queryFn: () => apiGet<any>(`/orders?page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}${serverFilter ? `&createdById=${serverFilter}` : ''}${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });

  const { data: articlesData } = useQuery({
    queryKey: ['articles-menu'],
    queryFn: () => apiGet<any>('/articles?limit=200&menuOnly=true'),
  });

  const { data: statsData } = useQuery({
    queryKey: ['order-stats', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/orders/stats/${currentEstId}`) : null,
    enabled: !!currentEstId,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<any>('/orders', body),
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      setShowModal(false);
      const invoiceId = response?.data?.invoiceId;
      if (invoiceId) {
        try {
          const qrRes = await apiGet<any>(`/invoices/${invoiceId}/qrcode`);
          if (qrRes?.data) {
            setQrModal({
              open: true,
              invoiceId,
              qrCode: qrRes.data.qrCode,
              invoiceNumber: qrRes.data.invoice?.invoiceNumber,
              totalAmount: qrRes.data.invoice?.totalAmount,
              paymentLabel: qrRes.data.paymentLabel,
              currency: qrRes.data.invoice?.currency || 'XOF',
            });
          }
        } catch {
          toast.success('Commande créée (QR code indisponible)');
        }
      }
      resetForm();
      toast.success('Commande créée — facture générée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => apiPatch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      toast.success('Statut mis à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const resetForm = () => setForm({ establishmentId: currentEstId || '', tableNumber: '', paymentMethod: 'MOOV_MONEY', items: [{ articleId: '', quantity: 1 }], notes: '' });

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { articleId: '', quantity: 1 }] }));
  const removeItem = (idx: number) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

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
        <div className="grid grid-cols-3 gap-4">
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
      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-48">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="IN_PROGRESS">En cours</option>
          <option value="READY">Prête</option>
          <option value="SERVED">Servie</option>
          <option value="CANCELLED">Annulée</option>
        </select>
        {isDAFOrManager && (
          <select value={serverFilter} onChange={(e) => { setServerFilter(e.target.value); setPage(1); }} className="input w-56">
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
        <div className="card">
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
                    <td className="font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="text-gray-500">{order.tableNumber || '-'}</td>
                    <td className="text-sm text-gray-600">
                      {order.items?.map((item) => (
                        <div key={item.id}>{item.quantity}x {item.article?.name || item.articleId}</div>
                      ))}
                    </td>
                    <td className="font-medium">{formatCurrency(order.totalAmount)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">
                          {order.paymentMethod === 'MOOV_MONEY' ? 'Flooz' : order.paymentMethod === 'MIXX_BY_YAS' ? 'Yas' : order.paymentMethod || '-'}
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
                      </div>
                    </td>
                    <td className="text-gray-500 text-sm">{order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}</td>
                    <td className="text-gray-400 text-xs">{formatDateTime(order.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
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
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Le client doit scanner ce QR code avec son application {qrModal.paymentLabel} pour effectuer le paiement.
          </p>
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
            tableNumber: form.tableNumber || undefined,
            paymentMethod: form.paymentMethod,
            items: form.items.filter((i) => i.articleId),
            notes: form.notes || undefined,
          };
          createMutation.mutate(body);
        }} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">N° Table (optionnel)</label>
              <input value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} className="input" placeholder="Ex: T1, 12..." />
            </div>
            <div>
              <label className="label">Moyen de paiement</label>
              <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })} className="input">
                <option value="MOOV_MONEY">Flooz (Moov Money)</option>
                <option value="MIXX_BY_YAS">Yas (MTN)</option>
                <option value="CASH">Espèces</option>
                <option value="CARD">Carte bancaire</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Virement</option>
              </select>
            </div>
            <div>
              <label className="label">Notes (optionnel)</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Instructions spéciales..." />
            </div>
          </div>

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
                    {articles.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.unitPrice)}</option>
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
    </div>
  );
}
