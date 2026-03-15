'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { formatCurrency, statusLabels } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage, ConfirmDialog } from '@/components/ui';
import { BedDouble, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Room, RoomType, PaginatedResponse } from '@/types';

export default function RoomsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  // Form state
  const [form, setForm] = useState({
    establishmentId: '', number: '', floor: '', type: 'DOUBLE' as RoomType,
    pricePerNight: '', maxOccupancy: '2', description: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['rooms', page, search, statusFilter],
    queryFn: () => apiGet<PaginatedResponse<Room>>(`/rooms?page=${page}&limit=20&search=${search}&status=${statusFilter}`),
  });

  const { data: establishments } = useQuery({
    queryKey: ['establishments-list'],
    queryFn: () => apiGet<any>('/establishments?limit=50'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/rooms', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowModal(false);
      resetForm();
      toast.success('Chambre créée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiPatch(`/rooms/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowModal(false);
      setEditingRoom(null);
      resetForm();
      toast.success('Chambre mise à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDeleteTarget(null);
      toast.success('Chambre désactivée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const resetForm = () => {
    setForm({ establishmentId: '', number: '', floor: '', type: 'DOUBLE', pricePerNight: '', maxOccupancy: '2', description: '' });
  };

  const openCreate = () => {
    resetForm();
    setEditingRoom(null);
    setShowModal(true);
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setForm({
      establishmentId: room.establishment?.id || '',
      number: room.number,
      floor: String(room.floor || ''),
      type: room.type,
      pricePerNight: String(room.pricePerNight),
      maxOccupancy: String(room.maxOccupancy),
      description: room.description || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      establishmentId: form.establishmentId,
      number: form.number,
      floor: form.floor ? Number(form.floor) : undefined,
      type: form.type,
      pricePerNight: Number(form.pricePerNight),
      maxOccupancy: Number(form.maxOccupancy),
      description: form.description || undefined,
    };

    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const rooms = data?.data || [];
  const meta = data?.meta;

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chambres"
        subtitle={`${meta?.total || 0} chambre${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" /> Nouvelle chambre
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Chercher par numéro..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">Tous les statuts</option>
          <option value="AVAILABLE">Disponible</option>
          <option value="OCCUPIED">Occupée</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="OUT_OF_ORDER">Hors service</option>
        </select>
      </div>

      {/* Table */}
      {rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="Aucune chambre"
          description="Créez votre première chambre pour commencer"
          action={<button onClick={openCreate} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Créer</button>}
        />
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Établissement</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Prix/nuit</th>
                  <th>Capacité</th>
                  <th>Étage</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="font-semibold text-gray-900">{room.number}</td>
                    <td>{room.establishment?.name}</td>
                    <td>{statusLabels[room.type] || room.type}</td>
                    <td><StatusBadge status={room.status} /></td>
                    <td className="font-medium">{formatCurrency(room.pricePerNight)}</td>
                    <td>{room.maxOccupancy} pers.</td>
                    <td>{room.floor ?? '-'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(room)} className="btn-ghost p-1.5"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteTarget(room)} className="btn-ghost p-1.5 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditingRoom(null); }} title={editingRoom ? 'Modifier la chambre' : 'Nouvelle chambre'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Établissement</label>
              <select value={form.establishmentId} onChange={(e) => setForm({ ...form, establishmentId: e.target.value })} className="input" required>
                <option value="">Sélectionner...</option>
                {(establishments?.data || []).map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Numéro</label>
              <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="input" placeholder="101" required />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoomType })} className="input">
                <option value="SINGLE">Simple</option>
                <option value="DOUBLE">Double</option>
                <option value="SUITE">Suite</option>
                <option value="FAMILY">Familiale</option>
                <option value="DELUXE">Deluxe</option>
              </select>
            </div>
            <div>
              <label className="label">Prix par nuit</label>
              <input type="number" value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })} className="input" placeholder="45000" required min="0" />
            </div>
            <div>
              <label className="label">Capacité max</label>
              <input type="number" value={form.maxOccupancy} onChange={(e) => setForm({ ...form, maxOccupancy: e.target.value })} className="input" min="1" max="20" />
            </div>
            <div>
              <label className="label">Étage</label>
              <input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="input" placeholder="1" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRoom ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Désactiver la chambre"
        message={`Êtes-vous sûr de vouloir désactiver la chambre ${deleteTarget?.number} ?`}
        confirmLabel="Désactiver"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
