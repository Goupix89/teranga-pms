'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { Receipt, Plus, Send, XCircle, Loader2, FileDown, Merge, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';
import { api } from '@/lib/api';
import type { Invoice, PaginatedResponse } from '@/types';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const canDownloadPdf = isSuperAdmin || ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER'].includes(currentEstRole || '');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTable, setMergeTable] = useState('');
  const [mergeInvoices, setMergeInvoices] = useState<any[]>([]);
  const [mergeSelected, setMergeSelected] = useState<string[]>([]);
  const [isFetchingMerge, setIsFetchingMerge] = useState(false);
  const [items, setItems] = useState([{ description: '', quantity: '1', unitPrice: '' }]);
  const [taxRate, setTaxRate] = useState('0');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search, statusFilter],
    queryFn: () => apiGet<PaginatedResponse<Invoice>>(`/invoices?page=${page}&limit=20&search=${search}&status=${statusFilter}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/invoices', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowCreate(false);
      setItems([{ description: '', quantity: '1', unitPrice: '' }]);
      toast.success('Facture créée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/invoices/${id}/issue`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Facture émise');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/invoices/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Facture annulée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const mergeMutation = useMutation({
    mutationFn: (body: { invoiceIds: string[]; tableNumber?: string }) => apiPost('/invoices/merge', body),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowMerge(false);
      setMergeTable('');
      setMergeInvoices([]);
      setMergeSelected([]);
      const combined = data?.data?.combinedOrder;
      const msg = combined
        ? `Factures regroupées — ${data?.data?.invoiceNumber} — Commande ${combined.orderNumber}`
        : `Factures regroupées — ${data?.data?.invoiceNumber || 'nouvelle facture créée'}`;
      toast.success(msg);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors du regroupement'),
  });

  const fetchMergeableInvoices = async () => {
    if (!mergeTable.trim()) return;
    setIsFetchingMerge(true);
    try {
      const res = await apiGet<{ data: any[] }>(`/invoices/by-table/${encodeURIComponent(mergeTable.trim())}`);
      setMergeInvoices(res.data || []);
      setMergeSelected((res.data || []).map((inv: any) => inv.id));
    } catch {
      toast.error('Erreur lors de la recherche');
      setMergeInvoices([]);
    } finally {
      setIsFetchingMerge(false);
    }
  };

  const toggleMergeSelect = (id: string) => {
    setMergeSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const downloadInvoicePdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement de la facture');
    }
  };

  const addItem = () => setItems([...items, { description: '', quantity: '1', unitPrice: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: string) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    setItems(updated);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      items: items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
      })),
      taxRate: Number(taxRate),
    });
  };

  const invoices = data?.data || [];
  const meta = data?.meta;

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        subtitle={`${meta?.total || 0} facture${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowMerge(true)} className="btn-secondary"><Merge className="mr-2 h-4 w-4" /> Regrouper</button>
            <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle facture</button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} /></div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="ISSUED">Émise</option>
          <option value="PAID">Payée</option>
          <option value="OVERDUE">En retard</option>
          <option value="MERGED">Fusionnée</option>
        </select>
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucune facture" />
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead><tr><th>N° Facture</th><th>Détails</th><th>Montant</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-semibold text-gray-900">{inv.invoiceNumber}</td>
                    <td>
                      <div className="space-y-0.5">
                        {inv.reservation ? (
                          <>
                            <div className="font-medium text-gray-900">{inv.reservation.guestName}</div>
                            <div className="text-xs text-gray-500">
                              Chambre {inv.reservation.room?.number}
                            </div>
                          </>
                        ) : inv.orders?.length ? (
                          <>
                            <div className="font-medium text-gray-900">
                              {inv.orders.map((o) => o.orderNumber).join(', ')}
                            </div>
                          </>
                        ) : null}
                        {inv.notes && (
                          <div className="text-xs text-gray-400 truncate max-w-[250px]" title={inv.notes}>{inv.notes}</div>
                        )}
                        {!inv.reservation && !inv.orders?.length && !inv.notes && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="font-medium">{formatCurrency(inv.totalAmount)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>{formatDate(inv.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        {canDownloadPdf && (
                          <button onClick={() => downloadInvoicePdf(inv.id, inv.invoiceNumber)} className="btn-ghost p-1.5 text-gray-600" title="Télécharger PDF">
                            <FileDown className="h-4 w-4" />
                          </button>
                        )}
                        {inv.status === 'DRAFT' && (
                          <button onClick={() => issueMutation.mutate(inv.id)} className="btn-ghost p-1.5 text-primary-600" title="Émettre">
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {['DRAFT', 'ISSUED'].includes(inv.status) && (
                          <button onClick={() => cancelMutation.mutate(inv.id)} className="btn-ghost p-1.5 text-red-500" title="Annuler">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle facture" size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Articles</label>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="input flex-1" placeholder="Description" required />
                <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="input w-20" min="1" required />
                <input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} className="input w-32" placeholder="Prix" min="0" required />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="btn-ghost text-red-500 p-2"><XCircle className="h-4 w-4" /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="btn-ghost text-sm text-primary-600"><Plus className="mr-1 h-4 w-4" />Ajouter un article</button>
          </div>
          <div className="w-32">
            <label className="label">Taxe (%)</label>
            <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="input" min="0" max="100" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </Modal>

      {/* Merge invoices modal */}
      <Modal open={showMerge} onClose={() => { setShowMerge(false); setMergeInvoices([]); setMergeSelected([]); setMergeTable(''); }} title="Regrouper les factures d'une table" size="xl">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={mergeTable}
              onChange={(e) => setMergeTable(e.target.value)}
              className="input flex-1"
              placeholder="Numéro de table (ex: 5)"
              onKeyDown={(e) => e.key === 'Enter' && fetchMergeableInvoices()}
            />
            <button
              type="button"
              onClick={fetchMergeableInvoices}
              className="btn-primary"
              disabled={isFetchingMerge || !mergeTable.trim()}
            >
              {isFetchingMerge ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Rechercher</span>
            </button>
          </div>

          {mergeInvoices.length === 0 && !isFetchingMerge && mergeTable && (
            <p className="text-sm text-gray-500 text-center py-4">Aucune facture ouverte pour la table {mergeTable}</p>
          )}

          {mergeInvoices.length === 1 && (
            <p className="text-sm text-amber-600 text-center py-4">Une seule facture trouvée — il faut au moins 2 factures pour regrouper</p>
          )}

          {mergeInvoices.length >= 2 && (
            <>
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {mergeInvoices.map((inv) => (
                  <label key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mergeSelected.includes(inv.id)}
                      onChange={() => toggleMergeSelect(inv.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{inv.invoiceNumber}</span>
                        <span className="text-xs text-gray-500">{formatCurrency(inv.totalAmount)}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {inv.orders?.map((o: any) => o.orderNumber).join(', ')}
                        {inv.items?.length > 0 && ` — ${inv.items.length} article(s)`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{mergeSelected.length} facture(s) sélectionnée(s)</p>
                  <p className="text-lg font-bold text-primary-700">
                    Total: {formatCurrency(
                      mergeInvoices
                        .filter((inv) => mergeSelected.includes(inv.id))
                        .reduce((sum: number, inv: any) => sum + inv.totalAmount, 0)
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => mergeMutation.mutate({ invoiceIds: mergeSelected, tableNumber: mergeTable })}
                  className="btn-primary"
                  disabled={mergeSelected.length < 2 || mergeMutation.isPending}
                >
                  {mergeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Merge className="mr-2 h-4 w-4" />
                  Regrouper en 1 facture
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
