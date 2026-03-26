'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { CalendarCheck, Calendar, Plus, LogIn, LogOut, XCircle, Loader2, QrCode, FileDown, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';
import { api } from '@/lib/api';
import type { Reservation, PaginatedResponse, PaymentMethod } from '@/types';

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentEstablishmentRole = useAuthStore((s) => s.currentEstablishmentRole);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const canDownload = isSuperAdmin || ['OWNER', 'DAF', 'MANAGER', 'SERVER'].includes(currentEstablishmentRole || '');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDates, setEditingDates] = useState<Reservation | null>(null);
  const [dateForm, setDateForm] = useState({ checkIn: '', checkOut: '' });

  const [form, setForm] = useState({
    roomId: '', guestName: '', guestEmail: '', guestPhone: '',
    checkIn: '', checkOut: '', numberOfGuests: '1', source: 'DIRECT',
    paymentMethod: 'CASH' as PaymentMethod, notes: '',
  });

  const [qrModal, setQrModal] = useState<{
    open: boolean; invoiceId?: string; qrCode?: string; invoiceNumber?: string;
    totalAmount?: number; paymentLabel?: string; currency?: string; paid?: boolean;
    fedapayCheckoutUrl?: string;
  }>({ open: false });

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', page, search, statusFilter],
    queryFn: () => apiGet<PaginatedResponse<Reservation>>(`/reservations?page=${page}&limit=20&search=${search}&status=${statusFilter}`),
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms-select'],
    queryFn: () => apiGet<any>('/rooms?limit=100&status=AVAILABLE'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<any>('/reservations', body),
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setShowModal(false);
      const invoiceId = response?.data?.invoiceId;
      if (invoiceId) {
        try {
          const qrRes = await apiGet<any>(`/invoices/${invoiceId}/qrcode?paymentMethod=${form.paymentMethod}`);
          if (qrRes?.data) {
            setQrModal({
              open: true,
              invoiceId,
              qrCode: qrRes.data.qrCode,
              invoiceNumber: qrRes.data.invoice?.invoiceNumber,
              totalAmount: qrRes.data.invoice?.totalAmount,
              paymentLabel: qrRes.data.paymentLabel,
              currency: qrRes.data.invoice?.currency || 'XOF',
              fedapayCheckoutUrl: qrRes.data.fedapayCheckoutUrl,
            });
          }
        } catch {
          toast.success('Réservation créée (QR code indisponible)');
        }
      }
      toast.success('Réservation créée — facture générée');
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
      paymentMethod: form.paymentMethod,
      notes: form.notes || undefined,
    });
  };

  const showQrCode = async (invoiceId: string) => {
    try {
      const qrRes = await apiGet<any>(`/invoices/${invoiceId}/qrcode`);
      if (qrRes?.data) {
        setQrModal({
          open: true,
          invoiceId,
          qrCode: qrRes.data.qrCode,
          invoiceNumber: qrRes.data.invoice?.invoiceNumber,
          totalAmount: qrRes.data.invoice?.totalAmount,
          paymentLabel: qrRes.data.paymentLabel,
          currency: qrRes.data.invoice?.currency || 'XOF',
          fedapayCheckoutUrl: qrRes.data.fedapayCheckoutUrl,
        });
      }
    } catch {
      toast.error('QR code indisponible');
    }
  };

  const downloadReceipt = async (reservationId: string, guestName: string) => {
    try {
      const res = await api.get(`/reservations/${reservationId}/receipt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `recu-reservation-${guestName.replace(/\s/g, '_')}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement du reçu');
    }
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
                  <th>Paiement</th>
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
                    <td>
                      <div className="flex items-center gap-1">
                        {res.invoices && res.invoices.length > 0 && (
                          <>
                            <span className="text-xs text-gray-500">
                              {res.invoices[0].status === 'PAID' ? (
                                <span className="text-green-600 font-medium">Payée</span>
                              ) : (
                                <span className="text-amber-600">En attente</span>
                              )}
                            </span>
                            <button
                              onClick={() => showQrCode(res.invoices![0].id)}
                              className="btn-ghost p-1 text-primary-600 hover:text-primary-700"
                              title="QR code de paiement"
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canDownload && (
                          <button
                            onClick={() => downloadReceipt(res.id, res.guestName)}
                            className="btn-ghost p-1 text-gray-600 hover:text-gray-800"
                            title="Télécharger le reçu PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
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

      {/* QR Code payment modal */}
      <Modal open={qrModal.open} onClose={() => setQrModal({ open: false })} title="QR Code de paiement" size="md">
        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-gray-900">Facture {qrModal.invoiceNumber}</p>
            <p className="text-2xl font-bold text-primary-700">{formatCurrency(qrModal.totalAmount || 0)} {qrModal.currency}</p>
            <p className="text-sm text-gray-500">Paiement par <span className="font-medium text-gray-700">{qrModal.paymentLabel}</span></p>
          </div>
          {qrModal.qrCode && (
            <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-primary-100">
              <img src={qrModal.qrCode} alt="QR Code de paiement" className="w-64 h-64" />
            </div>
          )}
          {qrModal.fedapayCheckoutUrl ? (
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Scannez le QR code ou cliquez sur le bouton ci-dessous pour payer via FedaPay.
            </p>
          ) : (
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Le client doit scanner ce QR code avec son application {qrModal.paymentLabel} pour effectuer le paiement.
            </p>
          )}
          {qrModal.paid ? (
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3 w-full justify-center">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Paiement reçu !</span>
              </div>
              <button onClick={() => { setQrModal({ open: false }); queryClient.invalidateQueries({ queryKey: ['reservations'] }); }} className="btn-primary w-full">
                Fermer
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {qrModal.fedapayCheckoutUrl && (
                <a
                  href={qrModal.fedapayCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary bg-blue-600 hover:bg-blue-700 w-full text-center flex items-center justify-center gap-2"
                >
                  💳 Payer avec FedaPay
                </a>
              )}
              <button
                onClick={async () => {
                  try {
                    await apiPost(`/invoices/${qrModal.invoiceId}/simulate-payment`, {});
                    setQrModal((prev) => ({ ...prev, paid: true }));
                    queryClient.invalidateQueries({ queryKey: ['reservations'] });
                    toast.success('Paiement simulé avec succès !');
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Erreur simulation paiement');
                  }
                }}
                className="btn-primary bg-green-600 hover:bg-green-700 w-full"
              >
                Simuler le paiement client
              </button>
              <button onClick={() => setQrModal({ open: false })} className="btn-secondary w-full">
                Fermer
              </button>
            </div>
          )}
        </div>
      </Modal>

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
            <div className="col-span-2">
              <label className="label">Moyen de paiement</label>
              <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })} className="input">
                <option value="CASH">Espèces</option>
                <option value="MOOV_MONEY">Flooz (Moov Money)</option>
                <option value="MIXX_BY_YAS">Yas (MTN)</option>
                <option value="CARD">Carte bancaire</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="FEDAPAY">FedaPay</option>
                <option value="BANK_TRANSFER">Virement</option>
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
