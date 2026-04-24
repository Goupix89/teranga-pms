'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useOfflineStatus, pingNow } from '@/hooks/useOfflineStatus';
import { countPending, offlineDb } from '@/lib/offline-db';
import { forceSync, onSyncComplete, startSync } from '@/lib/offline-sync';
import { useAuthStore } from '@/hooks/useAuthStore';
import { toast } from 'sonner';

/**
 * Fixed-position badge surfaced at the top-right of the dashboard.
 *
 * Three visual states:
 *   - hidden: online + empty queue
 *   - amber:  online + queue has items (sync in progress)
 *   - red:    offline
 *
 * Clickable → offline queue page. Long-press / secondary action → force sync.
 * The manual "forcer" button only appears for OWNER/DAF (per UX reco).
 */
export function OfflineBadge() {
  const { online } = useOfflineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const role = useAuthStore((s) => s.currentEstablishmentRole);
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === 'SUPERADMIN' || role === 'OWNER' || role === 'DAF';

  const refresh = async () => {
    const total = await countPending();
    setPendingCount(total);
    const conflicts = await offlineDb.pendingOps.where('status').equals('conflict').count();
    setConflictCount(conflicts);
  };

  useEffect(() => {
    startSync();
    refresh();

    const unsub = onSyncComplete(() => refresh());
    const intv = setInterval(refresh, 5000);
    return () => {
      clearInterval(intv);
      unsub();
    };
  }, []);

  const handleForce = async () => {
    setSyncing(true);
    try {
      const reachable = await pingNow();
      if (!reachable) {
        toast.error('Serveur injoignable — réessayez quand le réseau est rétabli.');
        return;
      }
      const result = await forceSync();
      if (result.ok > 0) {
        toast.success(`${result.ok} opération${result.ok > 1 ? 's' : ''} synchronisée${result.ok > 1 ? 's' : ''}`);
      } else if (result.conflict > 0) {
        toast.error(`${result.conflict} conflit${result.conflict > 1 ? 's' : ''} — voir la file d'attente`);
      } else {
        toast.info('Rien à synchroniser');
      }
      refresh();
    } finally {
      setSyncing(false);
    }
  };

  if (online && pendingCount === 0 && conflictCount === 0) {
    return null;
  }

  const bgClass = !online
    ? 'bg-red-600 text-white hover:bg-red-700'
    : conflictCount > 0
      ? 'bg-red-500 text-white hover:bg-red-600'
      : 'bg-amber-500 text-white hover:bg-amber-600';

  const Icon = !online
    ? WifiOff
    : conflictCount > 0
      ? AlertTriangle
      : Wifi;

  const label = !online
    ? `Hors-ligne${pendingCount > 0 ? ` — ${pendingCount} en attente` : ''}`
    : conflictCount > 0
      ? `${conflictCount} conflit${conflictCount > 1 ? 's' : ''}`
      : `Synchronisation — ${pendingCount}`;

  return (
    <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
      <Link
        href="/dashboard/offline-queue"
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md transition-colors ${bgClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </Link>
      {isAdmin && online && (
        <button
          onClick={handleForce}
          disabled={syncing}
          title="Forcer la synchronisation"
          className="rounded-full bg-white p-1.5 shadow-md text-gray-600 hover:text-primary-600 disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
