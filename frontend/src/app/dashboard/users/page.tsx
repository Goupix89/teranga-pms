'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage, ConfirmDialog } from '@/components/ui';
import { Users as UsersIcon, Plus, Pencil, Archive, ArchiveRestore, Trash2, Loader2, Building2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, statusLabels } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { EstablishmentRole } from '@/types';

const estRoleOptions: Array<{ value: EstablishmentRole; label: string }> = [
  { value: 'OWNER', label: 'Propriétaire' },
  { value: 'DAF', label: 'DAF' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'MAITRE_HOTEL', label: 'Maître d\'hôtel' },
  { value: 'SERVER', label: 'Serveur' },
  { value: 'POS', label: 'Point de vente' },
  { value: 'COOK', label: 'Cuisinier' },
  { value: 'CLEANER', label: 'Ménage' },
];

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const isOwnerOrDAF = currentEstRole === 'OWNER' || currentEstRole === 'DAF' || isSuperAdmin;
  const isManager = currentEstRole === 'MANAGER';
  const canCreateUser = isOwnerOrDAF || isManager;
  const canEditUser = isOwnerOrDAF;
  const canArchiveUser = isOwnerOrDAF;
  const canApprove = isOwnerOrDAF;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [archiveTarget, setArchiveTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const defaultForm = { email: '', password: '', firstName: '', lastName: '', phone: '', establishmentIds: [] as string[], establishmentRole: 'SERVER' as EstablishmentRole };
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

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/users/${id}/unarchive`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Utilisateur désarchivé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/${id}/permanent`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setDeleteTarget(null); toast.success('Utilisateur supprimé définitivement'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const openEdit = (u: any) => {
    setEditTarget(u);
    const firstMembership = u.memberships?.[0];
    setForm({
      email: u.email,
      password: '',
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone || '',
      establishmentIds: u.memberships?.map((m: any) => m.establishmentId) || [],
      establishmentRole: firstMembership?.role || 'SERVER',
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
  const getRoleOptions = (): Array<{ value: EstablishmentRole; label: string }> => {
    // SUPERADMIN can create any role
    if (isSuperAdmin) return estRoleOptions;
    // OWNER can create all except OWNER
    if (currentEstRole === 'OWNER') return estRoleOptions.filter((o) => o.value !== 'OWNER');
    // DAF can create MANAGER, SERVER, POS, COOK, CLEANER
    if (currentEstRole === 'DAF') return estRoleOptions.filter((o) => !['OWNER', 'DAF'].includes(o.value));
    // MANAGER can only create MAITRE_HOTEL, SERVER, COOK, CLEANER
    return estRoleOptions.filter((o) => ['MAITRE_HOTEL', 'SERVER', 'COOK', 'CLEANER'].includes(o.value));
  };

  const users = data?.data || [];
  const meta = data?.meta;
  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" subtitle={`${meta?.total || 0} utilisateur${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={canCreateUser && <button onClick={() => { setForm(defaultForm); setShowModal(true); }} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvel utilisateur</button>} />

      <div className="w-64"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher..." /></div>

      {users.length === 0 ? <EmptyState icon={UsersIcon} title="Aucun utilisateur" /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead><tr><th>Nom</th><th>Email</th><th>Établissements & Rôles</th><th>Statut</th><th>Dernière connexion</th><th></th></tr></thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="font-medium text-gray-900">{u.firstName} {u.lastName}</td>
                    <td className="text-gray-500">{u.email}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {u.role === 'SUPERADMIN'
                          ? <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700 font-medium">Super Admin</span>
                          : u.memberships?.length > 0
                            ? u.memberships.map((m: any) => (
                                <span key={m.establishmentId} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                  <Building2 className="h-3 w-3" />{m.establishment?.name} ({statusLabels[m.role] || m.role})
                                </span>
                              ))
                            : <span className="text-xs text-gray-400">Aucun</span>
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
                      {isSuperAdmin && u.status === 'ARCHIVED' && (
                        <button onClick={() => unarchiveMutation.mutate(u.id)} className="btn-ghost p-1.5 text-blue-600" title="Désarchiver">
                          <ArchiveRestore className="h-4 w-4" />
                        </button>
                      )}
                      {canEditUser && u.role !== 'SUPERADMIN' && <button onClick={() => openEdit(u)} className="btn-ghost p-1.5 text-gray-500"><Pencil className="h-4 w-4" /></button>}
                      {canArchiveUser && u.id !== currentUser?.id && u.role !== 'SUPERADMIN' && u.status !== 'ARCHIVED' && <button onClick={() => setArchiveTarget(u)} className="btn-ghost p-1.5 text-orange-500" title="Archiver"><Archive className="h-4 w-4" /></button>}
                      {isSuperAdmin && u.id !== currentUser?.id && u.role !== 'SUPERADMIN' && <button onClick={() => setDeleteTarget(u)} className="btn-ghost p-1.5 text-red-500" title="Supprimer définitivement"><Trash2 className="h-4 w-4" /></button>}
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
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvel utilisateur" size="md">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Prénom</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required /></div>
            <div><label className="label">Nom</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required /></div>
          </div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required /></div>
          <div><label className="label">Mot de passe</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required minLength={8} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rôle d'établissement</label>
              <select value={form.establishmentRole} onChange={(e) => setForm({ ...form, establishmentRole: e.target.value as EstablishmentRole })} className="input">
                {getRoleOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
          </div>
          {isManager && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">L'employé devra être approuvé par le DAF avant de pouvoir se connecter.</p>
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
              <label className="label">Rôle d'établissement</label>
              <select value={form.establishmentRole} onChange={(e) => setForm({ ...form, establishmentRole: e.target.value as EstablishmentRole })} className="input">
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

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && hardDeleteMutation.mutate(deleteTarget.id)}
        title="Supprimer définitivement" message={`Supprimer définitivement ${deleteTarget?.firstName} ${deleteTarget?.lastName} ? Cette action est irréversible et supprimera toutes les données associées.`} confirmLabel="Supprimer" danger loading={hardDeleteMutation.isPending} />
    </div>
  );
}
