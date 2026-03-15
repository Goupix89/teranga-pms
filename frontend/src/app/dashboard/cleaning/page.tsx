'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { PageHeader, StatusBadge, Pagination, Modal, EmptyState, LoadingPage } from '@/components/ui';
import { SprayCan, Play, Square, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, formatRelative } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { CleaningSession } from '@/types';

export default function CleaningPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const isCleaner = currentEstRole === 'CLEANER';

  const [page, setPage] = useState(1);
  const [showClockIn, setShowClockIn] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [notes, setNotes] = useState('');

  // Active sessions
  const { data: activeData } = useQuery({
    queryKey: ['cleaning-active', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/cleaning/active/${currentEstId}`) : null,
    enabled: !!currentEstId,
    refetchInterval: 30000,
  });

  // Session history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['cleaning-history', page, currentEstId],
    queryFn: () => apiGet<any>(`/cleaning?page=${page}&limit=20${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });

  // Available rooms
  const { data: roomsData } = useQuery({
    queryKey: ['rooms-for-cleaning', currentEstId],
    queryFn: () => apiGet<any>(`/rooms?limit=200${currentEstId ? `&establishmentId=${currentEstId}` : ''}&status=AVAILABLE`),
  });

  const clockInMutation = useMutation({
    mutationFn: (body: any) => apiPost('/cleaning/clock-in', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning-active'] });
      queryClient.invalidateQueries({ queryKey: ['cleaning-history'] });
      queryClient.invalidateQueries({ queryKey: ['rooms-for-cleaning'] });
      setShowClockIn(false);
      setSelectedRoom('');
      setNotes('');
      toast.success('Pointage début enregistré — chambre en nettoyage');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const clockOutMutation = useMutation({
    mutationFn: (sessionId: string) => apiPost(`/cleaning/${sessionId}/clock-out`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning-active'] });
      queryClient.invalidateQueries({ queryKey: ['cleaning-history'] });
      queryClient.invalidateQueries({ queryKey: ['rooms-for-cleaning'] });
      toast.success('Pointage fin enregistré — chambre disponible');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const activeSessions: CleaningSession[] = activeData?.data || [];
  const history = historyData?.data || [];
  const meta = historyData?.meta;
  const rooms = roomsData?.data || [];

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ménage & Pointage"
        subtitle={`${activeSessions.length} session${activeSessions.length > 1 ? 's' : ''} active${activeSessions.length > 1 ? 's' : ''}`}
        action={
          (isCleaner || isSuperAdmin || currentEstRole === 'DAF' || currentEstRole === 'MANAGER') && (
            <button onClick={() => setShowClockIn(true)} className="btn-primary">
              <Play className="mr-2 h-4 w-4" /> Pointer (début)
            </button>
          )
        }
      />

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Sessions en cours</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map((session) => (
              <div key={session.id} className="card border-l-4 border-l-green-400 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900">Chambre {session.room?.number}</p>
                    {session.room?.floor !== undefined && session.room?.floor !== null && (
                      <p className="text-xs text-gray-500">Étage {session.room.floor}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 font-medium">
                    <Clock className="h-3 w-3" /> En cours
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-1">
                  {session.cleaner?.firstName} {session.cleaner?.lastName}
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Début : {formatDateTime(session.clockInAt)}
                </p>

                {session.notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mb-3">{session.notes}</p>
                )}

                <button
                  onClick={() => clockOutMutation.mutate(session.id)}
                  disabled={clockOutMutation.isPending}
                  className="w-full btn-primary bg-red-600 hover:bg-red-700 py-2"
                >
                  {clockOutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                  Pointer (fin)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Historique</h2>
        {history.length === 0 ? (
          <EmptyState icon={SprayCan} title="Aucun historique" description="Les sessions de ménage apparaîtront ici" />
        ) : (
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Chambre</th>
                    <th>Agent</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Durée</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((session: CleaningSession) => (
                    <tr key={session.id}>
                      <td className="font-medium text-gray-900">
                        {session.room?.number || '-'}
                        {session.room?.floor !== undefined && session.room?.floor !== null && (
                          <span className="text-xs text-gray-400 ml-1">(ét. {session.room.floor})</span>
                        )}
                      </td>
                      <td className="text-gray-600">{session.cleaner?.firstName} {session.cleaner?.lastName}</td>
                      <td className="text-gray-500 text-sm">{formatDateTime(session.clockInAt)}</td>
                      <td className="text-gray-500 text-sm">{session.clockOutAt ? formatDateTime(session.clockOutAt) : '-'}</td>
                      <td className="text-gray-600 font-medium">
                        {session.durationMinutes ? `${session.durationMinutes} min` : '-'}
                      </td>
                      <td><StatusBadge status={session.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
          </div>
        )}
      </div>

      {/* Clock-in modal */}
      <Modal open={showClockIn} onClose={() => setShowClockIn(false)} title="Pointer — Début de ménage" size="sm">
        <form onSubmit={(e) => {
          e.preventDefault();
          clockInMutation.mutate({
            establishmentId: currentEstId,
            roomId: selectedRoom,
            notes: notes || undefined,
          });
        }} className="space-y-4">
          <div>
            <label className="label">Chambre</label>
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="input" required>
              <option value="">Sélectionner une chambre</option>
              {rooms.map((room: any) => (
                <option key={room.id} value={room.id}>
                  Chambre {room.number} {room.floor !== null ? `(ét. ${room.floor})` : ''} — {room.type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes (optionnel)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Ex: nettoyage en profondeur..." />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowClockIn(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={clockInMutation.isPending}>
              {clockInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Commencer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
