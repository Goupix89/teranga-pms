/**
 * Offline persistence layer — IndexedDB via Dexie.
 *
 * Holds two kinds of data:
 *   1. Cached read data (articles, servers, tables) so the POS can run
 *      without a server round-trip. 7-day TTL.
 *   2. A write-ahead queue of operations the user performed while offline.
 *      Each carries an idempotency key so the server rejects replays.
 *
 * The queue is FIFO; one dependent op (e.g. payment on an order just created
 * offline) waits until its parent has been synced and the server ID is known.
 */

import Dexie, { Table } from 'dexie';

export type PendingOpStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

export type PendingOpType =
  | 'order.create'           // POST /orders
  | 'order.addItems'         // POST /orders/:id/items
  | 'order.updateStatus'     // POST /orders/:id/status
  | 'order.cashin'           // POST /orders/:id/cashin
  | 'payment.create'         // POST /payments
  | 'expense.create';        // POST /expenses

export interface PendingOp {
  id: string;                      // local UUID — primary key in Dexie
  type: PendingOpType;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;                     // relative path, e.g. /orders
  payload: unknown;                // JSON body
  idempotencyKey: string;          // server-side idempotency
  localRef?: string;               // local order number for display (LOC-...)
  dependsOnLocalId?: string;       // if op waits for another op to sync first
  serverId?: string;               // assigned by server after sync
  tenantId: string;
  establishmentId?: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
  status: PendingOpStatus;
  syncedAt?: number;
  // For the UI: snapshot of something recognizable
  summary?: string;
}

export interface CachedArticle {
  id: string;
  data: unknown;                   // full Article object
  cachedAt: number;
  tenantId: string;
  establishmentId: string;
}

export interface CachedLookup {
  key: string;                     // e.g. "servers:<estId>" or "tables:<estId>"
  data: unknown;
  cachedAt: number;
}

class OfflineDB extends Dexie {
  pendingOps!: Table<PendingOp, string>;
  cachedArticles!: Table<CachedArticle, string>;
  cachedLookups!: Table<CachedLookup, string>;

  constructor() {
    super('teranga_offline');
    this.version(1).stores({
      pendingOps: 'id, status, createdAt, tenantId, dependsOnLocalId, type',
      cachedArticles: 'id, tenantId, establishmentId, cachedAt',
      cachedLookups: 'key, cachedAt',
    });
  }
}

export const offlineDb = new OfflineDB();

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Upsert articles into the local cache, keyed by article id and establishment.
 * Older cached entries for the same establishment are pruned.
 */
export async function cacheArticles(
  tenantId: string,
  establishmentId: string,
  articles: Array<{ id: string } & Record<string, unknown>>
): Promise<void> {
  const now = Date.now();
  await offlineDb.transaction('rw', offlineDb.cachedArticles, async () => {
    await offlineDb.cachedArticles
      .where('establishmentId')
      .equals(establishmentId)
      .delete();
    await offlineDb.cachedArticles.bulkPut(
      articles.map((a) => ({
        id: a.id,
        data: a,
        cachedAt: now,
        tenantId,
        establishmentId,
      }))
    );
  });
}

export async function readCachedArticles(establishmentId: string): Promise<unknown[]> {
  const now = Date.now();
  const rows = await offlineDb.cachedArticles
    .where('establishmentId')
    .equals(establishmentId)
    .toArray();
  return rows
    .filter((r) => now - r.cachedAt <= CACHE_TTL_MS)
    .map((r) => r.data);
}

export async function cacheLookup(key: string, data: unknown): Promise<void> {
  await offlineDb.cachedLookups.put({ key, data, cachedAt: Date.now() });
}

export async function readLookup<T>(key: string): Promise<T | null> {
  const row = await offlineDb.cachedLookups.get(key);
  if (!row) return null;
  if (Date.now() - row.cachedAt > CACHE_TTL_MS) return null;
  return row.data as T;
}

export async function enqueueOp(op: Omit<PendingOp, 'status' | 'attempts' | 'createdAt'>): Promise<void> {
  await offlineDb.pendingOps.put({
    ...op,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  });
}

export async function listOps(
  filter?: { status?: PendingOpStatus | PendingOpStatus[] }
): Promise<PendingOp[]> {
  let q = offlineDb.pendingOps.orderBy('createdAt');
  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    const rows = await q.toArray();
    return rows.filter((r) => statuses.includes(r.status));
  }
  return q.toArray();
}

export async function countPending(): Promise<number> {
  return offlineDb.pendingOps
    .where('status')
    .anyOf('pending', 'syncing', 'conflict', 'failed')
    .count();
}

export async function updateOp(id: string, patch: Partial<PendingOp>): Promise<void> {
  await offlineDb.pendingOps.update(id, patch);
}

export async function removeOp(id: string): Promise<void> {
  await offlineDb.pendingOps.delete(id);
}

/**
 * When an op has been synced and the server returned an ID, fill it in on
 * dependent ops so they can substitute the local reference.
 */
export async function resolveDependents(localId: string, serverId: string): Promise<void> {
  const dependents = await offlineDb.pendingOps
    .where('dependsOnLocalId')
    .equals(localId)
    .toArray();
  for (const d of dependents) {
    const patched = substituteLocalId(d.payload, localId, serverId);
    const newUrl = d.url.replace(localId, serverId);
    await offlineDb.pendingOps.update(d.id, { payload: patched, url: newUrl });
  }
}

function substituteLocalId(payload: unknown, localId: string, serverId: string): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string') {
    return payload === localId ? serverId : payload;
  }
  if (Array.isArray(payload)) {
    return payload.map((p) => substituteLocalId(p, localId, serverId));
  }
  if (typeof payload === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = substituteLocalId(v, localId, serverId);
    }
    return out;
  }
  return payload;
}

/**
 * Generate a human-readable local reference for offline orders.
 * LOC-YYYYMMDD-NNNN where NNNN is derived from a daily counter kept in
 * localStorage so operators can distinguish multiple offline orders.
 */
export function nextLocalOrderRef(): string {
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const key = `teranga_local_counter_${day}`;
  const prev = typeof window !== 'undefined' ? Number(window.localStorage.getItem(key) || '0') : 0;
  const next = prev + 1;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, String(next));
  }
  return `LOC-${day}-${String(next).padStart(4, '0')}`;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
