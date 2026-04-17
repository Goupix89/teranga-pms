'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader, Modal, EmptyState, LoadingPage, ConfirmDialog } from '@/components/ui';
import { Percent, Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';

type Rule = {
  id: string;
  name: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  appliesTo: 'RESERVATION' | 'ORDER' | 'BOTH';
  minNights?: number | null;
  maxNights?: number | null;
  minAmount?: number | null;
  autoApply: boolean;
  isActive: boolean;
};

type NightsScope = 'none' | 'exact' | 'range' | 'min' | 'max';

const emptyForm = {
  name: '',
  description: '',
  type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  value: 10,
  appliesTo: 'ORDER' as 'RESERVATION' | 'ORDER' | 'BOTH',
  nightsScope: 'none' as NightsScope,
  exactNights: '',
  minNights: '',
  maxNights: '',
  minAmount: '',
  autoApply: false,
};

function deriveScopeFromRule(rule: { minNights?: number | null; maxNights?: number | null }): NightsScope {
  const hasMin = rule.minNights != null;
  const hasMax = rule.maxNights != null;
  if (hasMin && hasMax && rule.minNights === rule.maxNights) return 'exact';
  if (hasMin && hasMax) return 'range';
  if (hasMin) return 'min';
  if (hasMax) return 'max';
  return 'none';
}

export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const { currentEstablishmentRole } = useAuthStore();
  const isOwner = currentEstablishmentRole === 'OWNER';

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['discount-rules'],
    queryFn: () => apiGet<any>('/discount-rules'),
  });

  const rules: Rule[] = data?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/discount-rules', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-rules'] });
      setShowForm(false);
      setForm(emptyForm);
      toast.success('Règle créée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: any) => apiPatch(`/discount-rules/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-rules'] });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success('Règle mise à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/discount-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-rules'] });
      setDeleteTarget(null);
      toast.success('Règle désactivée');
    },
  });

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    const scope = deriveScopeFromRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      type: rule.type,
      value: Number(rule.value),
      appliesTo: rule.appliesTo,
      nightsScope: scope,
      exactNights: scope === 'exact' ? (rule.minNights?.toString() || '') : '',
      minNights: scope === 'range' || scope === 'min' ? (rule.minNights?.toString() || '') : '',
      maxNights: scope === 'range' || scope === 'max' ? (rule.maxNights?.toString() || '') : '',
      minAmount: rule.minAmount?.toString() || '',
      autoApply: rule.autoApply,
    });
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let minNights: number | undefined;
    let maxNights: number | undefined;
    switch (form.nightsScope) {
      case 'exact': {
        const n = form.exactNights ? Number(form.exactNights) : NaN;
        if (!Number.isFinite(n) || n <= 0) { toast.error('Indiquez un nombre de nuits valide'); return; }
        minNights = n; maxNights = n;
        break;
      }
      case 'range': {
        const mn = form.minNights ? Number(form.minNights) : NaN;
        const mx = form.maxNights ? Number(form.maxNights) : NaN;
        if (!Number.isFinite(mn) || !Number.isFinite(mx)) { toast.error('Indiquez un intervalle valide'); return; }
        if (mx < mn) { toast.error('Le max doit être ≥ au min'); return; }
        minNights = mn; maxNights = mx;
        break;
      }
      case 'min':
        minNights = form.minNights ? Number(form.minNights) : undefined;
        break;
      case 'max':
        maxNights = form.maxNights ? Number(form.maxNights) : undefined;
        break;
    }
    const body: any = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      value: Number(form.value),
      appliesTo: form.appliesTo,
      minNights,
      maxNights,
      minAmount: form.minAmount ? Number(form.minAmount) : undefined,
      autoApply: form.autoApply,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remises"
        subtitle={isOwner ? 'Définissez les règles applicables aux réservations et commandes' : 'Règles définies par le propriétaire'}
        action={isOwner ? (
          <button
            onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" /> Nouvelle règle
          </button>
        ) : undefined}
      />

      {rules.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="Aucune règle personnalisée"
          description={isOwner ? "Créez des règles de remise pour vos réservations ou commandes." : "Le propriétaire n'a défini aucune règle."}
        />
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Valeur</th>
                  <th>Applicable à</th>
                  <th>Conditions</th>
                  <th>Auto</th>
                  <th>Statut</th>
                  {isOwner && <th className="w-0"></th>}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className={!r.isActive ? 'opacity-50' : ''}>
                    <td>
                      <div className="font-medium">{r.name}</div>
                      {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                    </td>
                    <td className="text-xs text-gray-500">{r.type === 'PERCENTAGE' ? 'Pourcentage' : 'Montant fixe'}</td>
                    <td className="font-medium">
                      {r.type === 'PERCENTAGE'
                        ? `${Number(r.value)} %`
                        : `${Math.round(Number(r.value)).toLocaleString('fr-FR')} FCFA`}
                    </td>
                    <td>
                      <span className="text-xs rounded px-2 py-0.5 bg-gray-100">
                        {r.appliesTo === 'BOTH' ? 'Réservation + Commande' : r.appliesTo === 'RESERVATION' ? 'Réservation' : 'Commande'}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">
                      {(() => {
                        const parts: string[] = [];
                        if (r.minNights && r.maxNights) {
                          parts.push(r.minNights === r.maxNights ? `${r.minNights} nuit${r.minNights > 1 ? 's' : ''}` : `${r.minNights} à ${r.maxNights} nuits`);
                        } else if (r.minNights) {
                          parts.push(`≥ ${r.minNights} nuits`);
                        } else if (r.maxNights) {
                          parts.push(`≤ ${r.maxNights} nuits`);
                        }
                        if (r.minAmount) parts.push(`≥ ${Math.round(Number(r.minAmount)).toLocaleString('fr-FR')} FCFA`);
                        return parts.length ? parts.join(' · ') : '-';
                      })()}
                    </td>
                    <td>
                      {r.autoApply
                        ? <span className="text-xs rounded px-2 py-0.5 bg-emerald-100 text-emerald-700">Auto</span>
                        : <span className="text-xs text-gray-400">Manuel</span>}
                    </td>
                    <td>
                      {r.isActive
                        ? <span className="text-xs rounded px-2 py-0.5 bg-emerald-100 text-emerald-700">Actif</span>
                        : <span className="text-xs rounded px-2 py-0.5 bg-gray-100 text-gray-500">Désactivé</span>}
                    </td>
                    {isOwner && (
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(r)} className="btn-ghost p-1.5" title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(r)} className="btn-ghost p-1.5 text-red-500" title="Désactiver">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Modifier la règle' : 'Nouvelle règle de remise'} size="md">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="label">Description (optionnel)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="input">
                <option value="PERCENTAGE">Pourcentage</option>
                <option value="FIXED">Montant fixe</option>
              </select>
            </div>
            <div>
              <label className="label">Valeur {form.type === 'PERCENTAGE' ? '(%)' : '(FCFA)'}</label>
              <input type="number" min="0" max={form.type === 'PERCENTAGE' ? 100 : undefined} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Applicable à</label>
            <select value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value as any })} className="input">
              <option value="ORDER">Commandes restaurant</option>
              <option value="RESERVATION">Réservations</option>
              <option value="BOTH">Les deux</option>
            </select>
          </div>
          <div>
            <label className="label">Portée (nuits)</label>
            <select
              value={form.nightsScope}
              onChange={(e) => setForm({ ...form, nightsScope: e.target.value as NightsScope, exactNights: '', minNights: '', maxNights: '' })}
              className="input"
            >
              <option value="none">Aucune limite de nuits</option>
              <option value="exact">Exactement N nuits</option>
              <option value="range">Intervalle (de N à M nuits)</option>
              <option value="min">Au moins N nuits</option>
              <option value="max">Au plus N nuits</option>
            </select>
          </div>
          {form.nightsScope === 'exact' && (
            <div>
              <label className="label">Nombre de nuits</label>
              <input
                type="number" min="1" required
                value={form.exactNights}
                onChange={(e) => setForm({ ...form, exactNights: e.target.value })}
                className="input"
                placeholder="Ex: 6"
              />
              <p className="text-xs text-gray-500 mt-1">Ne s'applique que si la réservation fait exactement ce nombre de nuits.</p>
            </div>
          )}
          {form.nightsScope === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">De (nuits)</label>
                <input type="number" min="1" required value={form.minNights} onChange={(e) => setForm({ ...form, minNights: e.target.value })} className="input" placeholder="Ex: 3" />
              </div>
              <div>
                <label className="label">À (nuits)</label>
                <input type="number" min="1" required value={form.maxNights} onChange={(e) => setForm({ ...form, maxNights: e.target.value })} className="input" placeholder="Ex: 5" />
              </div>
            </div>
          )}
          {form.nightsScope === 'min' && (
            <div>
              <label className="label">Au moins (nuits)</label>
              <input type="number" min="1" required value={form.minNights} onChange={(e) => setForm({ ...form, minNights: e.target.value })} className="input" placeholder="Ex: 7" />
            </div>
          )}
          {form.nightsScope === 'max' && (
            <div>
              <label className="label">Au plus (nuits)</label>
              <input type="number" min="1" required value={form.maxNights} onChange={(e) => setForm({ ...form, maxNights: e.target.value })} className="input" placeholder="Ex: 2" />
            </div>
          )}
          <div>
            <label className="label">Min. montant (FCFA, optionnel)</label>
            <input type="number" min="0" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} className="input" placeholder="—" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.autoApply} onChange={(e) => setForm({ ...form, autoApply: e.target.checked })} />
            <span>Appliquer automatiquement si les conditions sont remplies</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Désactiver la règle"
        message={`Désactiver la règle "${deleteTarget?.name}" ? Les réservations/commandes existantes restent intactes.`}
        confirmLabel="Désactiver"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
