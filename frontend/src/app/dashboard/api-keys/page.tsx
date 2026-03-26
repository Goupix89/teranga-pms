'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader, Modal, EmptyState, LoadingPage } from '@/components/ui';
import { KeyRound, Plus, Loader2, Trash2, Copy, Check, Power, PowerOff, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  expiresAt: string;
  lastUsedAt: string | null;
  allowedIps: string[];
  createdAt: string;
};

type CreateResponse = {
  success: boolean;
  data: ApiKey & { key: string };
  message: string;
};

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: '', expiresInDays: '90', allowedIps: '' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiGet<{ success: boolean; data: ApiKey[] }>('/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<CreateResponse>('/api-keys', body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(res.data.key);
      setForm({ name: '', expiresInDays: '90', allowedIps: '' });
      toast.success('Clé API créée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch(`/api-keys/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Clé API mise à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setConfirmDelete(null);
      toast.success('Clé API supprimée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const ips = form.allowedIps
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
    createMutation.mutate({
      name: form.name,
      expiresInDays: parseInt(form.expiresInDays) || 90,
      allowedIps: ips,
    });
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success('Clé copiée dans le presse-papier');
    setTimeout(() => setCopied(false), 2000);
  };

  const keys = data?.data || [];
  if (isLoading) return <LoadingPage />;

  const isExpired = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clés API"
        subtitle={`${keys.length} clé${keys.length > 1 ? 's' : ''} — pour les intégrations WordPress, Channel Manager, etc.`}
        action={
          <button onClick={() => { setShowCreate(true); setCreatedKey(null); }} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" /> Nouvelle clé API
          </button>
        }
      />

      {keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucune clé API"
          description="Créez une clé API pour connecter votre site WordPress ou un Channel Manager."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Nom</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Préfixe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Expiration</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Dernière utilisation</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">IPs autorisées</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{k.prefix}...</code>
                  </td>
                  <td className="px-4 py-3">
                    {!k.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Désactivée
                      </span>
                    ) : isExpired(k.expiresAt) ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Expirée
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(k.expiresAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {Array.isArray(k.allowedIps) && k.allowedIps.length > 0
                      ? k.allowedIps.join(', ')
                      : 'Toutes'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleMutation.mutate({ id: k.id, isActive: !k.isActive })}
                        className={`btn-ghost p-1.5 ${k.isActive ? 'text-green-600 hover:text-red-600' : 'text-gray-400 hover:text-green-600'}`}
                        title={k.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {k.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(k.id)}
                        className="btn-ghost p-1.5 text-gray-400 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreatedKey(null); }} title="Nouvelle clé API" size="md">
        {createdKey ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Copiez cette clé maintenant. Elle ne sera plus affichée.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono border break-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyKey(createdKey)}
                  className="btn-primary p-2 flex-shrink-0"
                  title="Copier"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Utilisez cette clé dans le header <code className="bg-gray-100 px-1 rounded">X-Api-Key</code> de vos requêtes
              ou dans la configuration du plugin WordPress Teranga.
            </p>
            <div className="flex justify-end">
              <button onClick={() => { setShowCreate(false); setCreatedKey(null); }} className="btn-primary">
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Nom de la clé *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="Ex: Site WordPress, Channel Manager Booking.com"
                required
              />
            </div>
            <div>
              <label className="label">Durée de validité (jours)</label>
              <select
                value={form.expiresInDays}
                onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                className="input"
              >
                <option value="30">30 jours</option>
                <option value="90">90 jours</option>
                <option value="180">6 mois</option>
                <option value="365">1 an</option>
              </select>
            </div>
            <div>
              <label className="label">
                IPs autorisées <span className="text-gray-400 text-xs">(optionnel, séparées par des virgules)</span>
              </label>
              <input
                value={form.allowedIps}
                onChange={(e) => setForm({ ...form, allowedIps: e.target.value })}
                className="input"
                placeholder="Ex: 192.168.1.1, 10.0.0.5 (vide = toutes)"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer la clé
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Supprimer la clé API">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Cette action est irréversible. Toutes les intégrations utilisant cette clé cesseront de fonctionner.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary">
              Annuler
            </button>
            <button
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              className="btn-primary bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
