'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Wifi, WifiOff, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock, Loader2,
} from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/ui';
import { useOfflineStatus, pingNow } from '@/hooks/useOfflineStatus';
import { offlineDb, PendingOp, removeOp, updateOp } from '@/lib/offline-db';
import { forceSync } from '@/lib/offline-sync';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';

const TYPE_LABELS: Record<string, string> = {
  'order.create': 'Commande',
  'order.addItems': 'Ajout d\'articles',
  'order.updateStatus': 'Changement de statut',
  'order.cashin': 'Encaissement',
  'payment.create': 'Paiement',
  'expense.create': 'Décaissement',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-green-100 text-green-800',
  conflict: 'bg-red-100 text-red-800',
  failed: 'bg-gray-200 text-gray-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  syncing: 'Synchronisation…',
  synced: 'Synchronisé',
  conflict: 'À résoudre',
  failed: 'Échec',
};

export default function OfflineQueuePage() {
  const { online } = useOfflineStatus();
  const [forcing, setForcing] = useState(false);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.currentEstablishmentRole);
  const isAdmin = user?.role === 'SUPERADMIN' || role === 'OWNER' || role === 'DAF';

  const ops = useLiveQuery(
    () => offlineDb.pendingOps.orderBy('createdAt').reverse().toArray(),
    [],
    [] as PendingOp[]
  );

  const pending = ops.filter((o) => o.status === 'pending' || o.status === 'syncing');
  const conflicts = ops.filter((o) => o.status === 'conflict');
  const synced = ops.filter((o) => o.status === 'synced');

  const handleForce = async () => {
    setForcing(true);
    try {
      const reachable = await pingNow();
      if (!reachable) {
        toast.error('Serveur injoignable.');
        return;
      }
      const r = await forceSync();
      if (r.ok > 0) toast.success(`${r.ok} synchronisée(s)`);
      if (r.conflict > 0) toast.error(`${r.conflict} conflit(s) — revoir ci-dessous`);
      if (r.ok === 0 && r.conflict === 0) toast.info('Rien à synchroniser');
    } finally {
      setForcing(false);
    }
  };

  const handleRetry = async (op: PendingOp) => {
    await updateOp(op.id, { status: 'pending', lastError: undefined });
    toast.info('Remis en file d\'attente');
  };

  const handleDelete = async (op: PendingOp) => {
    if (!confirm(`Supprimer cette opération de la file ?\n${TYPE_LABELS[op.type]} — ${op.summary || op.localRef || op.id}`)) return;
    await removeOp(op.id);
    toast.success('Opération supprimée');
  };

  const handleClearSynced = async () => {
    if (!confirm(`Vider les ${synced.length} opérations synchronisées ?`)) return;
    await offlineDb.pendingOps.where('status').equals('synced').delete();
    toast.success('Historique vidé');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="File d'attente hors-ligne"
        subtitle={online ? 'Connecté au serveur' : 'Mode hors-ligne — les opérations seront envoyées au retour du réseau'}
        action={
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? 'En ligne' : 'Hors-ligne'}
            </div>
            {isAdmin && (
              <button
                onClick={handleForce}
                disabled={forcing || !online}
                className="btn-primary text-sm"
              >
                {forcing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Forcer la synchronisation
              </button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase font-medium">En attente</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-800">{pending.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs uppercase font-medium">À résoudre</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-800">{conflicts.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs uppercase font-medium">Synchronisées</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-800">{synced.length}</p>
        </div>
      </div>

      {/* Conflicts first — they block manual review */}
      {conflicts.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-sm font-bold text-red-700">
            Conflits à résoudre
          </h3>
          {conflicts.map((op) => (
            <ConflictCard key={op.id} op={op} onRetry={handleRetry} onDelete={handleDelete} />
          ))}
        </section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-sm font-bold text-wood-700">
            En attente de synchronisation
          </h3>
          {pending.map((op) => (
            <OpCard key={op.id} op={op} onDelete={handleDelete} canDelete={isAdmin} />
          ))}
        </section>
      )}

      {ops.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="Aucune opération en file"
          description="Toutes vos saisies sont synchronisées."
        />
      )}

      {/* Synced history (collapsed) */}
      {synced.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-wood-500">
              Historique des opérations synchronisées ({synced.length})
            </h3>
            <button
              onClick={handleClearSynced}
              className="text-xs text-gray-400 hover:text-red-600"
            >
              Vider l'historique
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Référence</th>
                  <th className="px-3 py-2">Saisi</th>
                  <th className="px-3 py-2">Synchronisé</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {synced.slice(0, 50).map((op) => (
                  <tr key={op.id}>
                    <td className="px-3 py-2 text-gray-700">{TYPE_LABELS[op.type] || op.type}</td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {op.localRef} {op.serverId && <span className="text-gray-400">→ {op.serverId.slice(0, 8)}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{formatDateTime(new Date(op.createdAt).toISOString())}</td>
                    <td className="px-3 py-2 text-gray-500">{op.syncedAt ? formatDateTime(new Date(op.syncedAt).toISOString()) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function OpCard({ op, onDelete, canDelete }: { op: PendingOp; onDelete: (op: PendingOp) => void; canDelete: boolean }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_BADGE[op.status]}`}>
              {STATUS_LABELS[op.status]}
            </span>
            <span className="font-medium text-gray-900">{TYPE_LABELS[op.type] || op.type}</span>
            {op.localRef && <span className="font-mono text-xs text-gray-400">{op.localRef}</span>}
          </div>
          {op.summary && <p className="mt-1 text-sm text-gray-600">{op.summary}</p>}
          <div className="mt-2 flex gap-4 text-xs text-gray-400">
            <span>Saisi le {formatDateTime(new Date(op.createdAt).toISOString())}</span>
            {op.attempts > 0 && <span>{op.attempts} tentative{op.attempts > 1 ? 's' : ''}</span>}
            {op.lastError && <span className="text-red-600">{op.lastError}</span>}
          </div>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(op)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ConflictCard({ op, onRetry, onDelete }: { op: PendingOp; onRetry: (op: PendingOp) => void; onDelete: (op: PendingOp) => void }) {
  return (
    <div className="card border-l-4 border-red-500 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-red-800">{TYPE_LABELS[op.type] || op.type}</span>
            {op.localRef && <span className="font-mono text-xs text-gray-400">{op.localRef}</span>}
          </div>
          {op.summary && <p className="mt-1 text-sm text-gray-700">{op.summary}</p>}
          <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
            <strong>Motif du conflit :</strong> {op.lastError || 'Erreur inconnue'}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Saisi le {formatDateTime(new Date(op.createdAt).toISOString())}
            {op.attempts > 0 && ` · ${op.attempts} tentatives`}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onRetry(op)}
            className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
            title="Réessayer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(op)}
            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
