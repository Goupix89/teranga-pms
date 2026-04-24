'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { PageHeader, Pagination, Modal, EmptyState, LoadingPage } from '@/components/ui';
import { Wallet, Plus, Trash2, Edit2, Loader2, TrendingDown, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { Expense, ExpenseCategory, PaymentMethod, Supplier } from '@/types';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SUPPLIES: 'Fournitures',
  SALARY: 'Salaires',
  UTILITIES: 'Électricité / eau',
  RENT: 'Loyer',
  MAINTENANCE: 'Entretien',
  TRANSPORT: 'Transport',
  MARKETING: 'Marketing',
  TAXES: 'Impôts & taxes',
  OTHER: 'Autre',
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  MOOV_MONEY: 'Flooz',
  MIXX_BY_YAS: 'Yas',
  FEDAPAY: 'FedaPay',
  OTHER: 'Autre',
};

function toDatetimeLocal(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultRange() {
  const to = todayIso();
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const from = d.toISOString().slice(0, 10);
  return { from, to };
}

type FormState = {
  amount: string;
  reason: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  supplierId: string;
  operationDate: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  amount: '',
  reason: '',
  category: 'OTHER',
  paymentMethod: 'CASH',
  supplierId: '',
  operationDate: toDatetimeLocal(),
  notes: '',
});

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const isDAF = isSuperAdmin || currentEstRole === 'OWNER' || currentEstRole === 'DAF';
  const canCreate = isDAF || currentEstRole === 'MANAGER';

  const [page, setPage] = useState(1);
  const [{ from, to }, setRange] = useState(defaultRange());
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const query = useMemo(() => {
    const parts = [
      `page=${page}`,
      `limit=20`,
      `from=${new Date(`${from}T00:00:00`).toISOString()}`,
      `to=${new Date(`${to}T23:59:59.999`).toISOString()}`,
    ];
    if (currentEstId) parts.push(`establishmentId=${currentEstId}`);
    if (categoryFilter) parts.push(`category=${categoryFilter}`);
    return parts.join('&');
  }, [page, from, to, currentEstId, categoryFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', query],
    queryFn: () => apiGet<any>(`/expenses?${query}`),
    enabled: !!currentEstId,
  });

  const { data: summary } = useQuery({
    queryKey: ['expense-summary', currentEstId, from, to],
    queryFn: () =>
      apiGet<any>(
        `/expenses/summary?from=${new Date(`${from}T00:00:00`).toISOString()}&to=${new Date(`${to}T23:59:59.999`).toISOString()}${currentEstId ? `&establishmentId=${currentEstId}` : ''}`
      ),
    enabled: !!currentEstId,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-for-expense'],
    queryFn: () => apiGet<any>('/suppliers?limit=200'),
  });
  const suppliers: Supplier[] = suppliersData?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/expenses', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
      setShowModal(false);
      setForm(emptyForm());
      toast.success('Décaissement enregistré');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiPut(`/expenses/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm());
      toast.success('Décaissement modifié');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
      toast.success('Décaissement supprimé');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      amount: String(e.amount),
      reason: e.reason,
      category: e.category,
      paymentMethod: e.paymentMethod,
      supplierId: e.supplierId || '',
      operationDate: toDatetimeLocal(e.operationDate),
      notes: e.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      toast.error('Montant invalide');
      return;
    }
    if (form.reason.trim().length < 3) {
      toast.error('Le motif est obligatoire (min. 3 caractères)');
      return;
    }
    const body: any = {
      amount,
      reason: form.reason.trim(),
      category: form.category,
      paymentMethod: form.paymentMethod,
      supplierId: form.supplierId || null,
      operationDate: new Date(form.operationDate).toISOString(),
      notes: form.notes.trim() || undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, body });
    } else {
      body.establishmentId = currentEstId;
      createMutation.mutate(body);
    }
  };

  const handleDelete = (e: Expense) => {
    if (!confirm(`Supprimer ce décaissement ?\n${e.reason} — ${formatCurrency(e.amount)}`)) return;
    deleteMutation.mutate(e.id);
  };

  const expenses: Expense[] = data?.data || [];
  const meta = data?.meta;
  const totalDecaisse = summary?.data?.total ?? 0;
  const totalCount = summary?.data?.count ?? 0;

  if (!currentEstId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Wallet}
          title="Sélectionnez un établissement"
          description="Les décaissements sont gérés par établissement."
        />
      </div>
    );
  }

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Décaissements"
        subtitle="Suivi des dépenses — impactent le CA net"
        action={
          canCreate && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" /> Nouveau décaissement
            </button>
          )
        }
      />

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="label text-xs">Du</label>
          <input
            type="date"
            value={from}
            onChange={(ev) => { setRange((r) => ({ ...r, from: ev.target.value })); setPage(1); }}
            className="input"
          />
        </div>
        <div>
          <label className="label text-xs">Au</label>
          <input
            type="date"
            value={to}
            onChange={(ev) => { setRange((r) => ({ ...r, to: ev.target.value })); setPage(1); }}
            className="input"
          />
        </div>
        <div>
          <label className="label text-xs">Catégorie</label>
          <select
            value={categoryFilter}
            onChange={(ev) => { setCategoryFilter(ev.target.value as any); setPage(1); }}
            className="input"
          >
            <option value="">Toutes</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Total période</span>
            </div>
            <div className="mt-1 text-xl font-bold text-red-700">
              {formatCurrency(totalDecaisse)}
            </div>
            <div className="text-xs text-red-500">{totalCount} décaissement{totalCount > 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aucun décaissement"
          description="Aucun décaissement sur cette période."
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Motif</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Méthode</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">Saisi par</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                        {formatDateTime(e.operationDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {e.reason}
                      {e.notes && <div className="text-xs text-gray-400">{e.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {CATEGORY_LABELS[e.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{METHOD_LABELS[e.paymentMethod]}</td>
                    <td className="px-4 py-3 text-gray-600">{e.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {e.performedBy ? `${e.performedBy.firstName} ${e.performedBy.lastName}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-red-600">
                      − {formatCurrency(e.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {isDAF && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(e)}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Modifier"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(e)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Supprimer"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
        </>
      )}

      {/* Create/edit modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? 'Modifier le décaissement' : 'Nouveau décaissement'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Montant (FCFA) *</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.amount}
              onChange={(ev) => setForm({ ...form, amount: ev.target.value })}
              className="input"
              required
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Motif *</label>
            <input
              type="text"
              value={form.reason}
              onChange={(ev) => setForm({ ...form, reason: ev.target.value })}
              className="input"
              required
              minLength={3}
              maxLength={500}
              placeholder="Ex. Achat gaz pour cuisine"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Catégorie</label>
              <select
                value={form.category}
                onChange={(ev) => setForm({ ...form, category: ev.target.value as ExpenseCategory })}
                className="input"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Méthode</label>
              <select
                value={form.paymentMethod}
                onChange={(ev) => setForm({ ...form, paymentMethod: ev.target.value as PaymentMethod })}
                className="input"
              >
                {Object.entries(METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Fournisseur (optionnel)</label>
            <select
              value={form.supplierId}
              onChange={(ev) => setForm({ ...form, supplierId: ev.target.value })}
              className="input"
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date d&apos;opération</label>
            <input
              type="datetime-local"
              value={form.operationDate}
              onChange={(ev) => setForm({ ...form, operationDate: ev.target.value })}
              className="input"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Rétrodatage jusqu&apos;à 15 jours, au-delà réservé aux superviseurs.
            </p>
          </div>
          <div>
            <label className="label">Notes (optionnel)</label>
            <textarea
              value={form.notes}
              onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
              className="input"
              rows={2}
              maxLength={1000}
              placeholder="Informations complémentaires"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowModal(false); setEditing(null); }}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
