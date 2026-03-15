'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { PageHeader, Pagination, Modal, SearchInput, EmptyState, LoadingPage, ConfirmDialog } from '@/components/ui';
import { Truck, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => apiGet<any>(`/suppliers?page=${page}&limit=20&search=${search}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/suppliers', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setShowCreate(false); setForm({ name: '', email: '', phone: '', address: '', notes: '' }); toast.success('Fournisseur créé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/suppliers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setDeleteTarget(null); toast.success('Fournisseur désactivé'); },
  });

  const suppliers = data?.data || [];
  const meta = data?.meta;
  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader title="Fournisseurs" subtitle={`${meta?.total || 0} fournisseur${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouveau fournisseur</button>} />
      <div className="w-64"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} /></div>

      {suppliers.length === 0 ? <EmptyState icon={Truck} title="Aucun fournisseur" /> : (
        <div className="card"><div className="table-container"><table>
          <thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th></th></tr></thead>
          <tbody>{suppliers.map((s: any) => (
            <tr key={s.id}>
              <td className="font-medium text-gray-900">{s.name}</td>
              <td className="text-gray-500">{s.email || '-'}</td>
              <td>{s.phone || '-'}</td>
              <td className="text-xs text-gray-400 max-w-[200px] truncate">{s.address || '-'}</td>
              <td><button onClick={() => setDeleteTarget(s)} className="btn-ghost p-1.5 text-red-500"><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}</tbody>
        </table></div>
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau fournisseur" size="md">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, email: form.email || undefined, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined }); }} className="space-y-4">
          <div><label className="label">Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
            <div><label className="label">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
          </div>
          <div><label className="label">Adresse</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></div>
          <div><label className="label">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} title="Désactiver le fournisseur" message={`Désactiver ${deleteTarget?.name} ?`} confirmLabel="Désactiver" danger loading={deleteMutation.isPending} />
    </div>
  );
}
