'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { CalendarCheck, Calendar, Plus, LogIn, LogOut, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { Reservation, PaginatedResponse } from '@/types';

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const currentEstablishmentRole = useAuthStore((s) => s.currentEstablishmentRole);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDates, setEditingDates] = useState<Reservation | null>(null);
  const [dateForm, setDateForm] = useState({ checkIn: '', checkOut: '' });

  const [form, setForm] = useState({
    roomId: '', guestName: '', guestEmail: '', guestPhone: '',
    checkIn: '', checkOut: '', numberOfGuests: '1', source: 'DIRECT', notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', page, search, statusFilter],
    queryFn: () => apiGet<PaginatedResponse<Reservation>>(`/reservations?page=${page}&limit=20&search=${search}&status=${statusFilter}`),
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms-select'],
    queryFn: () => apiGet<any>('/rooms?limit=100&status=AVAILABLE'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/reservations', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setShowModal(false);
      toast.success('Réservation créée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const datesMutation = useMutation({
    mutationFn: ({ id, checkIn, checkOut }: { id: string; checkIn: string; checkOut: string }) =>
      apiPatch(`/reservations/${id}/dates`, { checkIn, checkOut }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setEditingDates(null);
      toast.success('Modification soumise à validation du DAF');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiPost(`/reservations/${id}/${action}`),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      const labels: Record<string, string> = { 'check-in': 'Check-in effectué', 'check-out': 'Check-out effectué', cancel: 'Réservation annulée' };
      toast.success(labels[action] || 'Action effectuée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      roomId: form.roomId,
      guestName: form.guestName,
      guestEmail: form.guestEmail || undefined,
      guestPhone: form.guestPhone || undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      numberOfGuests: Number(form.numberOfGuests),
      source: form.source,
      notes: form.notes || undefined,
    });
  };

  const reservations = data?.data || [];
  const meta = data?.meta;

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réservations"
        subtitle={`${meta?.total || 0} réservation${(meta?.total || 0) > 1 ? 's' : ''}`}
        action={<button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle réservation</button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Nom du client..." />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="CONFIRMED">Confirmée</option>
          <option value="CHECKED_IN">Enregistré</option>
          <option value="CHECKED_OUT">Parti</option>
          <option value="CANCELLED">Annulée</option>
        </select>
      </div>

      {reservations.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Aucune réservation" description="Créez votre première réservation" />
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Chambre</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th>Statut</th>
                  <th>Montant</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td>
                      <p className="font-medium text-gray-900">{res.guestName}</p>
                      {res.guestEmail && <p className="text-xs text-gray-400">{res.guestEmail}</p>}
                    </td>
                    <td>{res.room?.number} <span className="text-xs text-gray-400">({res.room?.establishment?.name})</span></td>
                    <td>{formatDate(res.checkIn)}</td>
                    <td>{formatDate(res.checkOut)}</td>
                    <td><StatusBadge status={res.status} /></td>
                    <td className="font-medium">{formatCurrency(res.totalPrice)}</td>
                    <td className="text-xs">{res.source}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {res.status === 'CONFIRMED' && (
                          <button
                            onClick={() => actionMutation.mutate({ id: res.id, action: 'check-in' })}
                            className="btn-ghost p-1.5 text-emerald-600"
                            title="Check-in"
                          >
                            <LogIn className="h-4 w-4" />
                          </button>
                        )}
                        {res.status === 'CHECKED_IN' && (
                          <button
                            onClick={() => actionMutation.mutate({ id: res.id, action: 'check-out' })}
                            className="btn-ghost p-1.5 text-blue-600"
                            title="Check-out"
                          >
                            <LogOut className="h-4 w-4" />
                          </button>
                        )}
                        {currentEstablishmentRole === 'MANAGER' && !['CHECKED_OUT', 'CANCELLED'].includes(res.status) && (
                          <button
                            onClick={() => { setEditingDates(res); setDateForm({ checkIn: res.checkIn.slice(0, 10), checkOut: res.checkOut.slice(0, 10) }); }}
                            className="btn-ghost p-1.5 text-amber-600"
                            title="Modifier dates"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                        )}
                        {!['CHECKED_OUT', 'CANCELLED'].includes(res.status) && (
                          <button
                            onClick={() => actionMutation.mutate({ id: res.id, action: 'cancel' })}
                            className="btn-ghost p-1.5 text-red-500"
                            title="Annuler"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
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

      {/* Edit Dates Modal */}
      <Modal open={!!editingDates} onClose={() => setEditingDates(null)} title="Modifier les dates" size="md">
        <form onSubmit={(e) => { e.preventDefault(); if (editingDates) datesMutation.mutate({ id: editingDates.id, checkIn: dateForm.checkIn, checkOut: dateForm.checkOut }); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date d'arrivée</label>
              <input type="date" value={dateForm.checkIn} onChange={(e) => setDateForm({ ...dateForm, checkIn: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Date de départ</label>
              <input type="date" value={dateForm.checkOut} onChange={(e) => setDateForm({ ...dateForm, checkOut: e.target.value })} className="input" required />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditingDates(null)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={datesMutation.isPending}>
              {datesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Soumettre la modification
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle réservation" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Chambre</label>
              <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="input" required>
                <option value="">Sélectionner une chambre...</option>
                {(roomsData?.data || []).map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.number} — {r.type} ({formatCurrency(r.pricePerNight)}/nuit)
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Nom du client</label>
              <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} className="input" placeholder="+22890..." />
            </div>
            <div>
              <label className="label">Date d'arrivée</label>
              <input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Date de départ</label>
              <input type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Nombre de personnes</label>
              <input type="number" value={form.numberOfGuests} onChange={(e) => setForm({ ...form, numberOfGuests: e.target.value })} className="input" min="1" max="20" />
            </div>
            <div>
              <label className="label">Source</label>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="input">
                <option value="DIRECT">Direct</option>
                <option value="PHONE">Téléphone</option>
                <option value="WALK_IN">Walk-in</option>
                <option value="BOOKING_COM">Booking.com</option>
                <option value="EXPEDIA">Expedia</option>
                <option value="AIRBNB">Airbnb</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer la réservation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
