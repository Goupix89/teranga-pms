'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader, Modal, EmptyState, LoadingPage } from '@/components/ui';
import { Armchair, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';

export default function TablesPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [form, setForm] = useState({ number: '', label: '', capacity: 4 });

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-tables', currentEstId],
    queryFn: () => apiGet<any>(`/restaurant-tables${currentEstId ? `?establishmentId=${currentEstId}` : ''}`),
  });

  const tables = data?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<any>('/restaurant-tables', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
      setShowModal(false);
      resetForm();
      toast.success('Table créée');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiPatch<any>(`/restaurant-tables/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
      setShowModal(false);
      setEditingTable(null);
      resetForm();
      toast.success('Table mise à jour');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<any>(`/restaurant-tables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
      toast.success('Table supprimée');
    },
  });

  const resetForm = () => setForm({ number: '', label: '', capacity: 4 });

  const openCreate = () => {
    setEditingTable(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (table: any) => {
    setEditingTable(table);
    setForm({ number: table.number, label: table.label || '', capacity: table.capacity });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id, body: form });
    } else {
      createMutation.mutate({ ...form, establishmentId: currentEstId });
    }
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tables du restaurant"
        subtitle={`${tables.length} table${tables.length > 1 ? 's' : ''} configurée${tables.length > 1 ? 's' : ''}`}
        action={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="mr-1.5 h-4 w-4" /> Ajouter une table
          </button>
        }
      />

      {tables.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title="Aucune table configurée"
          description="Ajoutez les tables de votre restaurant pour les utiliser lors de la prise de commandes."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {tables.map((table: any) => (
            <div
              key={table.id}
              className="card-accent p-4 flex flex-col items-center text-center group relative"
            >
              <div className="rounded-xl bg-accent-50 p-3 mb-2">
                <Armchair className="h-6 w-6 text-accent-700" />
              </div>
              <p className="text-lg font-bold text-wood-800">{table.number}</p>
              {table.label && (
                <p className="text-xs text-wood-500">{table.label}</p>
              )}
              <p className="text-xs text-wood-400 mt-1">{table.capacity} places</p>

              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => openEdit(table)}
                  className="btn-ghost p-1.5 text-wood-500 hover:text-primary-600"
                  title="Modifier"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer la table ${table.number} ?`)) {
                      deleteMutation.mutate(table.id);
                    }
                  }}
                  className="btn-ghost p-1.5 text-wood-500 hover:text-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingTable(null); resetForm(); }}
        title={editingTable ? 'Modifier la table' : 'Nouvelle table'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Numéro / Identifiant *</label>
            <input
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              className="input"
              placeholder="Ex: T1, A3, Terrasse-1..."
              required
            />
          </div>
          <div>
            <label className="label">Libellé (optionnel)</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="input"
              placeholder="Ex: Coin fenêtre, Terrasse..."
            />
          </div>
          <div>
            <label className="label">Capacité (places)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 4 })}
              className="input"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setEditingTable(null); }} className="btn-secondary">
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || !form.number}
              className="btn-primary"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {editingTable ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
