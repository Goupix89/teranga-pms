'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { PageHeader, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { Building2, Plus, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';

export default function EstablishmentsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editEst, setEditEst] = useState<any>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', country: 'Togo', phone: '', email: '', website: '', starRating: '', currency: 'XOF' });
  const [editForm, setEditForm] = useState({ name: '', address: '', city: '', country: '', phone: '', email: '', website: '', starRating: '', currency: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['establishments', page],
    queryFn: () => apiGet<any>(`/establishments?page=${page}&limit=20`),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/establishments', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['establishments'] }); setShowCreate(false); toast.success('Établissement créé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiPatch(`/establishments/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['establishments'] }); setEditEst(null); toast.success('Établissement modifié'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const openEdit = (est: any) => {
    setEditForm({
      name: est.name || '',
      address: est.address || '',
      city: est.city || '',
      country: est.country || '',
      phone: est.phone || '',
      email: est.email || '',
      website: est.website || '',
      starRating: est.starRating ? String(est.starRating) : '',
      currency: est.currency || 'XOF',
    });
    setEditEst(est);
  };

  const establishments = data?.data || [];
  const meta = data?.meta;
  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader title="Établissements" subtitle={`${meta?.total || 0} établissement${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvel établissement</button>} />

      {establishments.length === 0 ? <EmptyState icon={Building2} title="Aucun établissement" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {establishments.map((est: any) => (
            <div key={est.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{est.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{est.city}, {est.country}</p>
                </div>
                <div className="flex items-center gap-2">
                  {est.starRating && <span className="text-amber-500 text-sm">{'★'.repeat(est.starRating)}</span>}
                  {isSuperAdmin && (
                    <button onClick={() => openEdit(est)} className="btn-ghost p-1.5 text-gray-500 hover:text-primary-600" title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{est.address}</p>
              {est.website && <a href={est.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline mt-1 block truncate">{est.website}</a>}
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>{est._count?.rooms || 0} chambres</span>
                <span>{est.currency}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel établissement" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, starRating: form.starRating ? Number(form.starRating) : undefined, website: form.website || undefined }); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required /></div>
            <div className="col-span-2"><label className="label">Adresse</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" required /></div>
            <div><label className="label">Ville</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" required /></div>
            <div><label className="label">Pays</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input" required /></div>
            <div><label className="label">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
            <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
            <div className="col-span-2"><label className="label">Site web <span className="text-wood-400 text-xs">(optionnel)</span></label><input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="input" placeholder="https://www.monhotel.com" /></div>
            <div><label className="label">Étoiles</label><input type="number" value={form.starRating} onChange={(e) => setForm({ ...form, starRating: e.target.value })} className="input" min="1" max="5" /></div>
            <div><label className="label">Devise</label><input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input" maxLength={3} /></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</button></div>
        </form>
      </Modal>

      {/* Edit Establishment Modal (SUPERADMIN only) */}
      <Modal open={!!editEst} onClose={() => setEditEst(null)} title="Modifier l'établissement" size="lg">
        <form onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate({
            id: editEst.id,
            body: {
              ...editForm,
              starRating: editForm.starRating ? Number(editForm.starRating) : undefined,
              website: editForm.website || undefined,
              phone: editForm.phone || undefined,
              email: editForm.email || undefined,
            },
          });
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nom</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input" required /></div>
            <div className="col-span-2"><label className="label">Adresse</label><input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="input" required /></div>
            <div><label className="label">Ville</label><input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="input" required /></div>
            <div><label className="label">Pays</label><input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} className="input" required /></div>
            <div><label className="label">Téléphone</label><input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input" /></div>
            <div><label className="label">Email</label><input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input" /></div>
            <div className="col-span-2"><label className="label">Site web <span className="text-wood-400 text-xs">(optionnel)</span></label><input type="url" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} className="input" placeholder="https://www.monhotel.com" /></div>
            <div><label className="label">Étoiles</label><input type="number" value={editForm.starRating} onChange={(e) => setEditForm({ ...editForm, starRating: e.target.value })} className="input" min="1" max="5" /></div>
            <div><label className="label">Devise</label><input value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} className="input" maxLength={3} /></div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditEst(null)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
