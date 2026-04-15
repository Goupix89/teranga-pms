'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader, Modal, EmptyState, LoadingPage, ConfirmDialog } from '@/components/ui';
import { Percent, Plus, Trash2, Loader2, Pencil, Info } from 'lucide-react';
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
  minAmount?: number | null;
  autoApply: boolean;
  isActive: boolean;
};

const emptyForm = {
  name: '',
  description: '',
  type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  value: 10,
  appliesTo: 'ORDER' as 'RESERVATION' | 'ORDER' | 'BOTH',
  minNights: '',
  minAmount: '',
  autoApply: false,
};

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
    setForm({
      name: rule.name,
      description: rule.description || '',
      type: rule.type,
      value: Number(rule.value),
      appliesTo: rule.appliesTo,
      minNights: rule.minNights?.toString() || '',
      minAmount: rule.minAmount?.toString() || '',
      autoApply: rule.autoApply,
    });
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      value: Number(form.value),
      appliesTo: form.appliesTo,
      minNights: form.minNights ? Number(form.minNights) : undefined,
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

      <div className="card border-l-4 border-l-amber-400 p-4 bg-amber-50/60">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <div className="font-medium">Remises automatiques long séjour (intégrées)</div>
            <ul className="mt-1 space-y-0.5 text-amber-800">
              <li>• 3 à 5 nuits → <strong>10%</strong></li>
              <li>• 6 nuits → <strong>20%</strong></li>
              <li>• Plus de 6 nuits → <strong>25%</strong></li>
            </ul>
            <div className="mt-1 text-xs text-amber-700">
              Ces remises s'appliquent automatiquement. Vos règles personnalisées peuvent s'ajouter ou remplacer si plus avantageuses.
            </div>
          </div>
        </div>
      </div>

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
                      {r.minNights ? `≥ ${r.minNights} nuits` : ''}
                      {r.minNights && r.minAmount ? ' · ' : ''}
                      {r.minAmount ? `≥ ${Math.round(Number(r.minAmount)).toLocaleString('fr-FR')} FCFA` : ''}
                      {!r.minNights && !r.minAmount ? '-' : ''}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Min. nuits (réservation)</label>
              <input type="number" min="0" value={form.minNights} onChange={(e) => setForm({ ...form, minNights: e.target.value })} className="input" placeholder="—" />
            </div>
            <div>
              <label className="label">Min. montant (FCFA)</label>
              <input type="number" min="0" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} className="input" placeholder="—" />
            </div>
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
