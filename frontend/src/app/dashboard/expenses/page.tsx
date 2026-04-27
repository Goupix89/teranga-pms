'use client';

import { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { PageHeader, Pagination, Modal, EmptyState, LoadingPage } from '@/components/ui';
import {
  Wallet, Plus, Trash2, Edit2, Loader2, TrendingDown,
  Calendar as CalendarIcon, FileText, Tag, X, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { Expense, ExpenseCategory, ExpenseCustomCategory, PaymentMethod, Supplier } from '@/types';

// ─── Labels ──────────────────────────────────────────────────────────────────

const ENUM_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
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
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement bancaire',
  MOBILE_MONEY: 'Mobile Money',
  MOOV_MONEY: 'Flooz',
  MIXX_BY_YAS: 'Yas',
  FEDAPAY: 'FedaPay',
  OTHER: 'Autre',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return { from: d.toISOString().slice(0, 10), to };
}

// ─── Types ───────────────────────────────────────────────────────────────────

// Category option shown in the selector: either an enum key or a custom category id
type CategoryOption =
  | { kind: 'enum'; key: ExpenseCategory; label: string }
  | { kind: 'custom'; id: string; label: string };

type FormState = {
  amount: string;
  reason: string;
  // When kind='enum', categoryKey is set. When kind='custom', customCategoryId is set.
  categoryKind: 'enum' | 'custom';
  categoryKey: ExpenseCategory;
  customCategoryId: string;
  paymentMethod: PaymentMethod;
  supplierId: string;
  operationDate: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  amount: '',
  reason: '',
  categoryKind: 'enum',
  categoryKey: 'OTHER',
  customCategoryId: '',
  paymentMethod: 'CASH',
  supplierId: '',
  operationDate: toDatetimeLocal(),
  notes: '',
});

// ─── Main page ───────────────────────────────────────────────────────────────

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
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  // Inline new-category creation state (inside the modal)
  const [newCatName, setNewCatName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const newCatInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const listQuery = useMemo(() => {
    const parts = [
      `page=${page}`,
      `limit=20`,
      `from=${new Date(`${from}T00:00:00`).toISOString()}`,
      `to=${new Date(`${to}T23:59:59.999`).toISOString()}`,
    ];
    if (currentEstId) parts.push(`establishmentId=${currentEstId}`);
    // categoryFilter may be an enum key or a custom category id — only enum supported server-side for now
    if (categoryFilter && Object.keys(ENUM_CATEGORY_LABELS).includes(categoryFilter)) {
      parts.push(`category=${categoryFilter}`);
    }
    return parts.join('&');
  }, [page, from, to, currentEstId, categoryFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', listQuery],
    queryFn: () => apiGet<any>(`/expenses?${listQuery}`),
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

  const { data: customCatsData, refetch: refetchCats } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => apiGet<any>('/expense-categories'),
  });
  const customCategories: ExpenseCustomCategory[] = customCatsData?.data || [];

  // Merged category options: enum categories first, then custom categories
  const categoryOptions: CategoryOption[] = [
    ...Object.entries(ENUM_CATEGORY_LABELS).map(([key, label]) => ({
      kind: 'enum' as const,
      key: key as ExpenseCategory,
      label,
    })),
    ...customCategories.map((c) => ({
      kind: 'custom' as const,
      id: c.id,
      label: c.name,
    })),
  ];

  // ── Mutations ──────────────────────────────────────────────────────────────

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

  const createCatMutation = useMutation({
    mutationFn: (name: string) => apiPost('/expense-categories', { name }),
    onSuccess: async (res: any) => {
      await refetchCats();
      const newCat = res.data as ExpenseCustomCategory;
      // Immediately select the new category in the form
      setForm((f) => ({ ...f, categoryKind: 'custom', customCategoryId: newCat.id }));
      setNewCatName('');
      setShowNewCatInput(false);
      toast.success(`Catégorie « ${newCat.name} » créée`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/expense-categories/${id}`),
    onSuccess: () => {
      refetchCats();
      toast.success('Catégorie supprimée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  // ── PDF download ───────────────────────────────────────────────────────────

  const downloadVoucher = async (expense: Expense) => {
    try {
      const token = useAuthStore.getState().accessToken ?? '';
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      const resp = await fetch(`${apiBase}/api/expenses/${expense.id}/voucher`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Erreur serveur');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bon-decaissement-${expense.id.slice(0, 8).toUpperCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Impossible de télécharger le bon PDF');
    }
  };

  // ── Form helpers ───────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowNewCatInput(false);
    setNewCatName('');
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    const isCustom = !!e.customCategoryId;
    setForm({
      amount: String(e.amount),
      reason: e.reason,
      categoryKind: isCustom ? 'custom' : 'enum',
      categoryKey: isCustom ? 'OTHER' : e.category,
      customCategoryId: e.customCategoryId || '',
      paymentMethod: e.paymentMethod,
      supplierId: e.supplierId || '',
      operationDate: toDatetimeLocal(e.operationDate),
      notes: e.notes || '',
    });
    setShowNewCatInput(false);
    setNewCatName('');
    setShowModal(true);
  };

  const handleCategorySelect = (value: string) => {
    if (value === '__new__') {
      setShowNewCatInput(true);
      setTimeout(() => newCatInputRef.current?.focus(), 50);
      return;
    }
    const enumKeys = Object.keys(ENUM_CATEGORY_LABELS);
    if (enumKeys.includes(value)) {
      setForm((f) => ({ ...f, categoryKind: 'enum', categoryKey: value as ExpenseCategory, customCategoryId: '' }));
    } else {
      setForm((f) => ({ ...f, categoryKind: 'custom', customCategoryId: value, categoryKey: 'OTHER' }));
    }
  };

  const currentCategoryValue =
    form.categoryKind === 'custom' ? form.customCategoryId : form.categoryKey;

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    createCatMutation.mutate(newCatName.trim());
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) { toast.error('Montant invalide'); return; }
    if (form.reason.trim().length < 3) { toast.error('Le motif est obligatoire (min. 3 caractères)'); return; }

    const body: any = {
      amount,
      reason: form.reason.trim(),
      paymentMethod: form.paymentMethod,
      supplierId: form.supplierId || null,
      operationDate: new Date(form.operationDate).toISOString(),
      notes: form.notes.trim() || undefined,
    };

    if (form.categoryKind === 'custom' && form.customCategoryId) {
      body.customCategoryId = form.customCategoryId;
      body.category = 'OTHER';
    } else {
      body.category = form.categoryKey;
      body.customCategoryId = null;
    }

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

  // ── Helpers display ────────────────────────────────────────────────────────

  const getCategoryLabel = (e: Expense) =>
    e.customCategory?.name ?? ENUM_CATEGORY_LABELS[e.category] ?? e.category;

  // ── Data ───────────────────────────────────────────────────────────────────

  const expenses: Expense[] = data?.data || [];
  const meta = data?.meta;
  const totalDecaisse = summary?.data?.total ?? 0;
  const totalCount = summary?.data?.count ?? 0;

  if (!currentEstId) {
    return (
      <div className="p-6">
        <EmptyState icon={Wallet} title="Sélectionnez un établissement" description="Les décaissements sont gérés par établissement." />
      </div>
    );
  }

  if (isLoading) return <LoadingPage />;

  // ── Render ─────────────────────────────────────────────────────────────────

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
            onChange={(ev) => { setCategoryFilter(ev.target.value); setPage(1); }}
            className="input"
          >
            <option value="">Toutes</option>
            <optgroup label="Catégories standards">
              {Object.entries(ENUM_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </optgroup>
            {customCategories.length > 0 && (
              <optgroup label="Catégories personnalisées">
                {customCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="flex items-end">
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Total période</span>
            </div>
            <div className="mt-1 text-xl font-bold text-red-700">{formatCurrency(totalDecaisse)}</div>
            <div className="text-xs text-red-500">{totalCount} décaissement{totalCount > 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      {expenses.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucun décaissement" description="Aucun décaissement sur cette période." />
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
                      <span className={`rounded-full px-2 py-0.5 text-xs ${e.customCategory ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-700'}`}>
                        {e.customCategory && <Tag className="mr-1 inline h-3 w-3" />}
                        {getCategoryLabel(e)}
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
                      <div className="flex justify-end gap-1">
                        {/* PDF voucher — available to all authorized readers */}
                        <button
                          onClick={() => downloadVoucher(e)}
                          className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                          title="Télécharger le bon PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        {isDAF && (
                          <>
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          )}
        </>
      )}

      {/* ── Create / edit modal ────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); setShowNewCatInput(false); setNewCatName(''); }}
        title={editing ? 'Modifier le décaissement' : 'Nouveau décaissement'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
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

          {/* Reason */}
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

          {/* Category + method */}
          <div className="grid grid-cols-2 gap-3">
            {/* Category selector with inline creation */}
            <div>
              <label className="label">Catégorie</label>

              {/* Inline new-category input */}
              {showNewCatInput ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={newCatInputRef}
                    type="text"
                    value={newCatName}
                    onChange={(ev) => setNewCatName(ev.target.value)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); handleCreateCategory(); } }}
                    className="input flex-1 text-sm"
                    placeholder="Nom de la catégorie"
                    maxLength={80}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!newCatName.trim() || createCatMutation.isPending}
                    className="rounded bg-green-600 p-1.5 text-white hover:bg-green-700 disabled:opacity-50"
                    title="Confirmer"
                  >
                    {createCatMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                    className="rounded bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300"
                    title="Annuler"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <select
                    value={currentCategoryValue}
                    onChange={(ev) => handleCategorySelect(ev.target.value)}
                    className="input flex-1"
                  >
                    <optgroup label="Catégories standards">
                      {Object.entries(ENUM_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </optgroup>
                    {customCategories.length > 0 && (
                      <optgroup label="Catégories personnalisées">
                        {customCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__new__">+ Nouvelle catégorie…</option>
                  </select>
                  {/* Quick delete button for selected custom category (DAF only) */}
                  {isDAF && form.categoryKind === 'custom' && form.customCategoryId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm('Supprimer cette catégorie personnalisée ?')) return;
                        deleteCatMutation.mutate(form.customCategoryId);
                        setForm((f) => ({ ...f, categoryKind: 'enum', categoryKey: 'OTHER', customCategoryId: '' }));
                      }}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title="Supprimer cette catégorie"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Hint that shows currently selected custom category */}
              {form.categoryKind === 'custom' && form.customCategoryId && (
                <p className="mt-1 flex items-center gap-1 text-xs text-violet-600">
                  <Tag className="h-3 w-3" />
                  {customCategories.find((c) => c.id === form.customCategoryId)?.name}
                </p>
              )}
            </div>

            {/* Payment method */}
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

          {/* Supplier */}
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

          {/* Operation date */}
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

          {/* Notes */}
          <div>
            <label className="label">Notes (optionnel)</label>
            <textarea
              value={form.notes}
              onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
              className="input"
              rows={2}
              maxLength={1000}
              placeholder="Informations complémentaires, N° de facture fournisseur…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowModal(false); setEditing(null); setShowNewCatInput(false); setNewCatName(''); }}
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
