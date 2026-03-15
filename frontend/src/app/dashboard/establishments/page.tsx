'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { PageHeader, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EstablishmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: '', country: 'Togo', phone: '', email: '', starRating: '', currency: 'XOF' });

  const { data, isLoading } = useQuery({
    queryKey: ['establishments', page],
    queryFn: () => apiGet<any>(`/establishments?page=${page}&limit=20`),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/establishments', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['establishments'] }); setShowCreate(false); toast.success('Établissement créé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

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
                {est.starRating && <span className="text-amber-500 text-sm">{'★'.repeat(est.starRating)}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-2">{est.address}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>{est._count?.rooms || 0} chambres</span>
                <span>{est.currency}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel établissement" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, starRating: form.starRating ? Number(form.starRating) : undefined }); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required /></div>
            <div className="col-span-2"><label className="label">Adresse</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" required /></div>
            <div><label className="label">Ville</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" required /></div>
            <div><label className="label">Pays</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input" required /></div>
            <div><label className="label">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
            <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
            <div><label className="label">Étoiles</label><input type="number" value={form.starRating} onChange={(e) => setForm({ ...form, starRating: e.target.value })} className="input" min="1" max="5" /></div>
            <div><label className="label">Devise</label><input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input" maxLength={3} /></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</button></div>
        </form>
      </Modal>
    </div>
  );
}
