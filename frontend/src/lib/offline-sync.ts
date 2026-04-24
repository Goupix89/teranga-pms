/**
 * Offline sync worker.
 *
 * Drains pendingOps from IndexedDB to the backend in FIFO order whenever the
 * network is up. Runs at module-load time (browser) via startSync() and also
 * exposes forceSync() for manual triggers.
 *
 * Rules:
 *   - Only process one op at a time. An op that creates a parent (order)
 *     must succeed before its child (cashin / payment referencing it).
 *   - Network errors → leave as `pending` and back off; the next tick retries.
 *   - 409 Conflict with the same idempotencyKey → treat as success (replay).
 *   - Business errors (4xx other than 409) → mark `conflict` for manual review.
 *   - 5xx / network → retry with exponential backoff (cap 5 min).
 *
 * This file never runs on the server; imports must be tree-shakeable client-only.
 */

import { api } from './api';
import {
  listOps,
  updateOp,
  removeOp,
  resolveDependents,
  PendingOp,
} from './offline-db';

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60 * 1_000;

let running = false;
let scheduled = false;

type SyncResult = {
  ok: number;
  conflict: number;
  blocked: number;
};

const listeners = new Set<(r: SyncResult) => void>();

export function onSyncComplete(cb: (r: SyncResult) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function computeBackoff(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1)), MAX_BACKOFF_MS);
}

async function processOne(op: PendingOp): Promise<'ok' | 'conflict' | 'retry' | 'blocked'> {
  // Blocked on parent
  if (op.dependsOnLocalId) {
    const parent = (await listOps()).find((o) => o.id === op.dependsOnLocalId);
    if (parent && parent.status !== 'synced') return 'blocked';
  }

  await updateOp(op.id, {
    status: 'syncing',
    attempts: op.attempts + 1,
    lastAttemptAt: Date.now(),
  });

  try {
    const headers: Record<string, string> = { 'X-Idempotency-Key': op.idempotencyKey };
    const resp = await api.request({
      method: op.method,
      url: op.url,
      data: op.payload,
      headers,
      timeout: 15_000,
    });

    const serverData = resp.data?.data ?? resp.data;
    const serverId = (serverData && typeof serverData === 'object' && 'id' in serverData)
      ? (serverData as { id: string }).id
      : undefined;

    if (serverId) {
      await resolveDependents(op.id, serverId);
    }

    await updateOp(op.id, {
      status: 'synced',
      syncedAt: Date.now(),
      serverId,
      lastError: undefined,
    });
    return 'ok';
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: { error?: string; data?: { id?: string } } }; message?: string };
    const status = e?.response?.status;
    const message = e?.response?.data?.error || e?.message || 'Erreur inconnue';

    // 409 with existing entity returned: treat as success
    if (status === 409) {
      const existingId = e?.response?.data?.data?.id;
      if (existingId) await resolveDependents(op.id, existingId);
      await updateOp(op.id, {
        status: 'synced',
        syncedAt: Date.now(),
        serverId: existingId,
        lastError: undefined,
      });
      return 'ok';
    }

    // Network / server down → retry later
    if (!status || status >= 500 || status === 408 || status === 429) {
      await updateOp(op.id, { status: 'pending', lastError: message });
      return 'retry';
    }

    // Auth expired → stop the whole drain; user must re-login
    if (status === 401 || status === 403) {
      await updateOp(op.id, { status: 'pending', lastError: message });
      return 'blocked';
    }

    // Business error (400, 404, 422...) → move to conflict, needs human
    await updateOp(op.id, { status: 'conflict', lastError: message });
    return 'conflict';
  }
}

export async function drainQueue(): Promise<SyncResult> {
  const result: SyncResult = { ok: 0, conflict: 0, blocked: 0 };
  if (running) return result;
  running = true;
  try {
    // Only target pending ops. conflict/synced/failed are skipped.
    const ops = (await listOps({ status: 'pending' }))
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const op of ops) {
      // Skip ops still in backoff
      if (op.attempts > 0 && op.lastAttemptAt) {
        const backoff = computeBackoff(op.attempts);
        if (Date.now() - op.lastAttemptAt < backoff) continue;
      }

      const outcome = await processOne(op);
      if (outcome === 'ok') result.ok++;
      else if (outcome === 'conflict') result.conflict++;
      else if (outcome === 'blocked') {
        result.blocked++;
        break; // don't keep hammering if blocked
      } else if (outcome === 'retry') {
        // leave for next tick
      }
    }
  } finally {
    running = false;
  }
  listeners.forEach((l) => l(result));
  return result;
}

/**
 * Periodic drain. Called from the app shell.
 * Also listens to browser online events for immediate drain.
 */
export function startSync() {
  if (scheduled || typeof window === 'undefined') return;
  scheduled = true;

  const tick = () => {
    drainQueue().catch(() => {
      /* intentionally swallowed; errors are persisted per-op */
    });
  };

  window.addEventListener('online', tick);
  // Heartbeat from useOfflineStatus also triggers: listen on focus
  window.addEventListener('focus', tick);

  // Tick every 15s as a fallback
  setInterval(tick, 15_000);

  // Kick off once
  tick();
}

/**
 * Manual trigger. Returns the sync result so the UI can flash a toast.
 */
export async function forceSync(): Promise<SyncResult> {
  return drainQueue();
}
