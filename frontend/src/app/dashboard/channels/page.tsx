'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader, Modal, EmptyState, LoadingPage } from '@/components/ui';
import { Globe2, Plus, Copy, RefreshCw, Trash2, ExternalLink, Check, AlertCircle, Clock, Loader2, KeyRound, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';
import { ChannelConnection, ChannelSyncLog, BookingSource } from '@/types';
import { cn } from '@/lib/utils';

const channelLabels: Record<string, string> = {
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb',
  CHANNEL_MANAGER: 'Channel Manager',
};

const channelColors: Record<string, string> = {
  BOOKING_COM: 'bg-blue-500',
  EXPEDIA: 'bg-yellow-500',
  AIRBNB: 'bg-rose-500',
  CHANNEL_MANAGER: 'bg-purple-500',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState<string | null>(null);

  // Form state
  const [formRoomId, setFormRoomId] = useState('');
  const [formChannel, setFormChannel] = useState<BookingSource>('AIRBNB');
  const [formImportUrl, setFormImportUrl] = useState('');

  // Fetch rooms for selector
  const { data: roomsData } = useQuery({
    queryKey: ['rooms-all', currentEstId],
    queryFn: () => apiGet<any>(`/rooms?limit=200${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });
  const rooms = roomsData?.data || [];

  // Fetch connections
  const { data: connectionsData, isLoading } = useQuery({
    queryKey: ['channels', currentEstId],
    queryFn: () => apiGet<any>(`/channels${currentEstId ? `?establishmentId=${currentEstId}` : ''}`),
  });
  const connections: ChannelConnection[] = connectionsData?.data || [];

  // Fetch logs for expanded connection
  const { data: detailData } = useQuery({
    queryKey: ['channel-detail', expandedId],
    queryFn: () => apiGet<any>(`/channels/${expandedId}`),
    enabled: !!expandedId,
  });
  const syncLogs: ChannelSyncLog[] = detailData?.data?.syncLogs || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { roomId: string; channel: BookingSource; importUrl?: string }) =>
      apiPost('/channels', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setShowCreate(false);
      setFormRoomId('');
      setFormImportUrl('');
      toast.success('Canal connecté');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiPatch(`/channels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Connexion mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setConfirmDelete(null);
      toast.success('Connexion supprimée');
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/channels/${id}/sync`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channel-detail'] });
      const r = data?.data;
      toast.success(`Sync terminé : ${r?.eventsCreated || 0} créée(s), ${r?.eventsUpdated || 0} mise(s) à jour, ${r?.eventsCancelled || 0} annulée(s)`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur de synchronisation'),
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/channels/${id}/regenerate-token`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setConfirmRegenerate(null);
      toast.success('Token régénéré — mettez à jour l\'URL dans votre OTA');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('URL copiée');
  };

  const handleCreate = () => {
    if (!formRoomId) return toast.error('Sélectionnez une chambre');
    createMutation.mutate({
      roomId: formRoomId,
      channel: formChannel,
      ...(formImportUrl ? { importUrl: formImportUrl } : {}),
    });
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canaux de réservation"
        subtitle="Synchronisez vos disponibilités avec Airbnb, Booking.com et autres plateformes via iCal."
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-wood-900 shadow-sm hover:bg-accent-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Connecter un canal
          </button>
        }
      />

      {connections.length === 0 ? (
        <EmptyState
          icon={Globe2}
          title="Aucun canal connecté"
          description="Connectez vos chambres aux plateformes de réservation pour synchroniser automatiquement les disponibilités."
        />
      ) : (
        <div className="space-y-4">
          {connections.map((conn) => {
            const exportUrl = `${getApiBaseUrl()}/api/calendar/${conn.exportToken}.ics`;
            const isExpanded = expandedId === conn.id;

            return (
              <div
                key={conn.id}
                className="rounded-xl border border-wood-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Channel badge */}
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-white text-xs font-bold', channelColors[conn.channel] || 'bg-gray-500')}>
                    {conn.channel === 'AIRBNB' ? 'AB' : conn.channel === 'BOOKING_COM' ? 'BK' : conn.channel === 'EXPEDIA' ? 'EX' : 'CM'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-wood-800">
                        {channelLabels[conn.channel] || conn.channel}
                      </span>
                      <span className="text-sm text-wood-500">
                        — Chambre {conn.room?.number}
                      </span>
                      {conn.room?.establishment?.name && (
                        <span className="text-xs text-wood-400">({conn.room.establishment.name})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-wood-500">
                      {conn.lastSyncAt ? (
                        <span className="flex items-center gap-1">
                          {conn.lastSyncStatus === 'OK' ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : conn.lastSyncStatus === 'ERROR' ? (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          ) : (
                            <Clock className="h-3 w-3 text-wood-400" />
                          )}
                          Dernier sync : {timeAgo(conn.lastSyncAt)}
                        </span>
                      ) : (
                        <span className="text-wood-400">Jamais synchronisé</span>
                      )}
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', conn.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {conn.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(exportUrl)}
                      className="rounded-lg p-2 text-wood-500 hover:bg-wood-100 hover:text-wood-700 transition-colors"
                      title="Copier l'URL d'export iCal"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => syncMutation.mutate(conn.id)}
                      disabled={syncMutation.isPending || !conn.importUrl}
                      className="rounded-lg p-2 text-wood-500 hover:bg-wood-100 hover:text-wood-700 transition-colors disabled:opacity-30"
                      title={conn.importUrl ? 'Synchroniser maintenant' : 'Aucune URL d\'import configurée'}
                    >
                      {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : conn.id)}
                      className="rounded-lg p-2 text-wood-500 hover:bg-wood-100 hover:text-wood-700 transition-colors"
                      title="Détails"
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-wood-100 bg-wood-50/50 px-5 py-4 space-y-4">
                    {/* Export URL */}
                    <div>
                      <label className="text-xs font-medium text-wood-500 uppercase tracking-wide">URL d'export (à coller dans l'OTA)</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          readOnly
                          value={exportUrl}
                          className="flex-1 rounded-lg border border-wood-200 bg-white px-3 py-2 text-sm text-wood-700 font-mono"
                        />
                        <button
                          onClick={() => copyToClipboard(exportUrl)}
                          className="rounded-lg bg-accent-500/10 px-3 py-2 text-sm font-medium text-accent-600 hover:bg-accent-500/20 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Import URL */}
                    <div>
                      <label className="text-xs font-medium text-wood-500 uppercase tracking-wide">URL d'import (depuis l'OTA)</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          defaultValue={conn.importUrl || ''}
                          placeholder="https://www.airbnb.com/calendar/ical/xxx.ics"
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== (conn.importUrl || '')) {
                              updateMutation.mutate({ id: conn.id, data: { importUrl: val || null } });
                            }
                          }}
                          className="flex-1 rounded-lg border border-wood-200 bg-white px-3 py-2 text-sm text-wood-700"
                        />
                        {conn.importUrl && (
                          <a
                            href={conn.importUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-wood-100 px-3 py-2 text-wood-500 hover:text-wood-700 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Settings row */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-sm text-wood-600">
                        <input
                          type="checkbox"
                          checked={conn.isActive}
                          onChange={(e) => updateMutation.mutate({ id: conn.id, data: { isActive: e.target.checked } })}
                          className="rounded border-wood-300"
                        />
                        Actif
                      </label>
                      <label className="flex items-center gap-2 text-sm text-wood-600">
                        Intervalle :
                        <select
                          value={conn.syncIntervalMin}
                          onChange={(e) => updateMutation.mutate({ id: conn.id, data: { syncIntervalMin: parseInt(e.target.value) } })}
                          className="rounded-lg border border-wood-200 px-2 py-1 text-sm"
                        >
                          <option value={15}>15 min</option>
                          <option value={30}>30 min</option>
                          <option value={60}>1 heure</option>
                          <option value={180}>3 heures</option>
                          <option value={360}>6 heures</option>
                          <option value={720}>12 heures</option>
                          <option value={1440}>24 heures</option>
                        </select>
                      </label>
                      <button
                        onClick={() => setConfirmRegenerate(conn.id)}
                        className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Régénérer le token
                      </button>
                      <button
                        onClick={() => setConfirmDelete(conn.id)}
                        className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Supprimer
                      </button>
                    </div>

                    {/* Sync logs */}
                    {syncLogs.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-wood-500 uppercase tracking-wide mb-2">Historique de synchronisation</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {syncLogs.map((log) => (
                            <div key={log.id} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded hover:bg-wood-100">
                              {log.status === 'OK' ? (
                                <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                              )}
                              <span className="text-wood-500">{timeAgo(log.createdAt)}</span>
                              <span className="text-wood-400">|</span>
                              <span className="text-wood-600">
                                {log.eventsFound} trouvé(s), {log.eventsCreated} créé(s), {log.eventsUpdated} maj, {log.eventsCancelled} annulé(s)
                              </span>
                              {log.durationMs && (
                                <span className="text-wood-400 ml-auto">{log.durationMs}ms</span>
                              )}
                              {log.errorMessage && (
                                <span className="text-red-500 truncate max-w-xs" title={log.errorMessage}>{log.errorMessage}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Connecter un canal"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-wood-700 mb-1">Chambre</label>
            <select
              value={formRoomId}
              onChange={(e) => setFormRoomId(e.target.value)}
              className="w-full rounded-xl border border-wood-200 px-3 py-2.5 text-sm focus:border-accent-500 focus:ring-accent-500"
            >
              <option value="">Sélectionner une chambre</option>
              {rooms.map((r: any) => (
                <option key={r.id} value={r.id}>
                  Chambre {r.number} ({r.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-wood-700 mb-1">Plateforme</label>
            <select
              value={formChannel}
              onChange={(e) => setFormChannel(e.target.value as BookingSource)}
              className="w-full rounded-xl border border-wood-200 px-3 py-2.5 text-sm focus:border-accent-500 focus:ring-accent-500"
            >
              <option value="AIRBNB">Airbnb</option>
              <option value="BOOKING_COM">Booking.com</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="CHANNEL_MANAGER">Channel Manager</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-wood-700 mb-1">
              URL d'import iCal <span className="text-wood-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="url"
              value={formImportUrl}
              onChange={(e) => setFormImportUrl(e.target.value)}
              placeholder="https://www.airbnb.com/calendar/ical/xxx.ics"
              className="w-full rounded-xl border border-wood-200 px-3 py-2.5 text-sm focus:border-accent-500 focus:ring-accent-500"
            />
            <p className="mt-1 text-xs text-wood-400">
              Collez ici l'URL iCal fournie par la plateforme pour importer les réservations externes.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 rounded-xl border border-wood-200 px-4 py-2.5 text-sm font-medium text-wood-600 hover:bg-wood-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex-1 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-wood-900 hover:bg-accent-400 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Connexion...' : 'Connecter'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Supprimer la connexion"
      >
        <p className="text-sm text-wood-600 mb-4">
          Cette action supprimera la connexion et l'URL d'export ne sera plus accessible.
          Les réservations déjà importées ne seront pas supprimées.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="flex-1 rounded-xl border border-wood-200 px-4 py-2.5 text-sm font-medium text-wood-600 hover:bg-wood-50"
          >
            Annuler
          </button>
          <button
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600"
          >
            Supprimer
          </button>
        </div>
      </Modal>

      {/* Regenerate token confirmation */}
      <Modal
        open={!!confirmRegenerate}
        onClose={() => setConfirmRegenerate(null)}
        title="Régénérer le token"
      >
        <p className="text-sm text-wood-600 mb-4">
          L'ancienne URL d'export cessera de fonctionner immédiatement.
          Vous devrez mettre à jour l'URL dans votre plateforme de réservation (Airbnb, Booking.com, etc.).
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmRegenerate(null)}
            className="flex-1 rounded-xl border border-wood-200 px-4 py-2.5 text-sm font-medium text-wood-600 hover:bg-wood-50"
          >
            Annuler
          </button>
          <button
            onClick={() => confirmRegenerate && regenerateMutation.mutate(confirmRegenerate)}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Régénérer
          </button>
        </div>
      </Modal>
    </div>
  );
}
