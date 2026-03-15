'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage, ConfirmDialog } from '@/components/ui';
import { Users as UsersIcon, Plus, Pencil, Archive, Loader2, Building2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const role = currentUser?.role;
  const isSuperAdmin = role === 'SUPERADMIN';
  const isAdmin = role === 'ADMIN' || isSuperAdmin;
  const isManager = role === 'MANAGER';
  const canCreateUser = isAdmin || isManager;
  const canEditUser = isAdmin;
  const canArchiveUser = isAdmin;
  const canApprove = isAdmin;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [archiveTarget, setArchiveTarget] = useState<any>(null);

  const defaultForm = { email: '', password: '', firstName: '', lastName: '', role: 'EMPLOYEE', phone: '', establishmentIds: [] as string[] };
  const [form, setForm] = useState(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => apiGet<any>(`/users?page=${page}&limit=20&search=${search}`),
  });

  const { data: estData } = useQuery({
    queryKey: ['establishments-all'],
    queryFn: () => apiGet<any>('/establishments?limit=100'),
  });

  const establishments = estData?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/users', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setShowModal(false); setForm(defaultForm); toast.success(isManager ? 'Employé créé (en attente de validation)' : 'Utilisateur créé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiPatch(`/users/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditTarget(null); toast.success('Utilisateur modifié'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setArchiveTarget(null); toast.success('Utilisateur archivé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/users/${id}/approve`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Utilisateur approuvé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const openEdit = (u: any) => {
    setEditTarget(u);
    setForm({
      email: u.email,
      password: '',
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      phone: u.phone || '',
      establishmentIds: u.establishments?.map((e: any) => e.id) || [],
    });
  };

  const handleEstToggle = (estId: string) => {
    setForm((prev) => ({
      ...prev,
      establishmentIds: prev.establishmentIds.includes(estId)
        ? prev.establishmentIds.filter((id) => id !== estId)
        : [...prev.establishmentIds, estId],
    }));
  };

  // Role options depend on who's creating
  const getRoleOptions = () => {
    if (isSuperAdmin) return [
      { value: 'EMPLOYEE', label: 'Employé' },
      { value: 'MANAGER', label: 'Manager' },
      { value: 'ADMIN', label: 'Admin Établissement' },
      { value: 'SUPERADMIN', label: 'Super Admin' },
    ];
    if (role === 'ADMIN') return [
      { value: 'EMPLOYEE', label: 'Employé' },
      { value: 'MANAGER', label: 'Manager' },
    ];
    // MANAGER can only create EMPLOYEE
    return [{ value: 'EMPLOYEE', label: 'Employé' }];
  };

  const users = data?.data || [];
  const meta = data?.meta;
  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" subtitle={`${meta?.total || 0} utilisateur${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={canCreateUser && <button onClick={() => { setForm(defaultForm); setShowModal(true); }} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> {isManager ? 'Nouvel employé' : 'Nouvel utilisateur'}</button>} />

      <div className="w-64"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher..." /></div>

      {users.length === 0 ? <EmptyState icon={UsersIcon} title="Aucun utilisateur" /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Établissements</th><th>Statut</th><th>Dernière connexion</th><th></th></tr></thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="font-medium text-gray-900">{u.firstName} {u.lastName}</td>
                    <td className="text-gray-500">{u.email}</td>
                    <td><StatusBadge status={u.role} /></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {u.establishments?.length > 0
                          ? u.establishments.map((e: any) => (
                              <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                <Building2 className="h-3 w-3" />{e.name}
                              </span>
                            ))
                          : <span className="text-xs text-gray-400">{u.role === 'SUPERADMIN' ? 'Tous' : 'Aucun'}</span>
                        }
                      </div>
                    </td>
                    <td><StatusBadge status={u.status} /></td>
                    <td className="text-gray-400 text-xs">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Jamais'}</td>
                    <td className="space-x-1">
                      {canApprove && u.status === 'PENDING_APPROVAL' && (
                        <button onClick={() => approveMutation.mutate(u.id)} className="btn-ghost p-1.5 text-green-600" title="Approuver">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {canEditUser && u.role !== 'SUPERADMIN' && <button onClick={() => openEdit(u)} className="btn-ghost p-1.5 text-gray-500"><Pencil className="h-4 w-4" /></button>}
                      {canArchiveUser && u.id !== currentUser?.id && u.role !== 'SUPERADMIN' && <button onClick={() => setArchiveTarget(u)} className="btn-ghost p-1.5 text-red-500"><Archive className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
        </div>
      )}

      {/* Create user modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={isManager ? 'Nouvel employé' : 'Nouvel utilisateur'} size="md">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Prénom</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required /></div>
            <div><label className="label">Nom</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required /></div>
          </div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required /></div>
          <div><label className="label">Mot de passe</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required minLength={8} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rôle</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
                {getRoleOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
          </div>
          {isManager && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">L'employé devra être approuvé par un administrateur avant de pouvoir se connecter.</p>
            </div>
          )}
          {establishments.length > 0 && (
            <div>
              <label className="label">Établissements assignés</label>
              <div className="mt-1 space-y-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {establishments.map((est: any) => (
                  <label key={est.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.establishmentIds.includes(est.id)}
                      onChange={() => handleEstToggle(est.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{est.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</button></div>
        </form>
      </Modal>

      {/* Edit user modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Modifier l'utilisateur" size="md">
        <form onSubmit={(e) => {
          e.preventDefault();
          const { email, password, ...body } = form;
          updateMutation.mutate({ id: editTarget?.id, body });
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Prénom</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required /></div>
            <div><label className="label">Nom</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rôle</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
                {getRoleOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
          </div>
          {establishments.length > 0 && (
            <div>
              <label className="label">Établissements assignés</label>
              <div className="mt-1 space-y-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {establishments.map((est: any) => (
                  <label key={est.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.establishmentIds.includes(est.id)}
                      onChange={() => handleEstToggle(est.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{est.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setEditTarget(null)} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</button></div>
        </form>
      </Modal>

      <ConfirmDialog open={!!archiveTarget} onClose={() => setArchiveTarget(null)} onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        title="Archiver l'utilisateur" message={`Archiver ${archiveTarget?.firstName} ${archiveTarget?.lastName} ? Cette action révoquera toutes ses sessions.`} confirmLabel="Archiver" danger loading={archiveMutation.isPending} />
    </div>
  );
}
