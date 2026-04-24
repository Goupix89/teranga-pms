'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

/**
 * Authoritative network state for the PWA.
 *
 * `navigator.onLine` is unreliable — browsers report online when the NIC is up
 * even if the backend is unreachable (captive portal, routing issue). We pair
 * it with a periodic heartbeat to /api/health and flip to offline the moment
 * the heartbeat fails.
 */

type State = {
  online: boolean;
  lastChecked: number;
  lastOk: number;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;

let state: State = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastChecked: 0,
  lastOk: 0,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: Partial<State>) {
  const merged = { ...state, ...next };
  if (
    merged.online === state.online &&
    merged.lastChecked === state.lastChecked &&
    merged.lastOk === state.lastOk
  ) {
    return;
  }
  state = merged;
  emit();
}

async function heartbeat(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    await api.get('/health', { signal: controller.signal, timeout: HEARTBEAT_TIMEOUT_MS });
    setState({ online: true, lastChecked: Date.now(), lastOk: Date.now() });
    return true;
  } catch {
    setState({ online: false, lastChecked: Date.now() });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let started = false;
function startHeartbeat() {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('online', () => {
    heartbeat();
  });
  window.addEventListener('offline', () => {
    setState({ online: false, lastChecked: Date.now() });
  });

  heartbeat();
  setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
}

function subscribe(l: () => void) {
  startHeartbeat();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot(): State {
  return state;
}

function getServerSnapshot(): State {
  return { online: true, lastChecked: 0, lastOk: 0 };
}

/**
 * Force a heartbeat check now (e.g. when the user clicks "Forcer la synchro").
 * Returns true if the server responded, false otherwise.
 */
export async function pingNow(): Promise<boolean> {
  return heartbeat();
}

export function useOfflineStatus() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    online: s.online,
    offline: !s.online,
    lastChecked: s.lastChecked,
    lastOk: s.lastOk,
  };
}

/**
 * Standalone start: call once from the app shell so the heartbeat is active
 * even when no component subscribes yet.
 */
export function useStartOfflineMonitor() {
  useEffect(() => {
    startHeartbeat();
  }, []);
}
