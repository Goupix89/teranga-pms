'use client';

import { useEffect } from 'react';

/**
 * Registers the app Service Worker at dashboard mount, regardless of whether
 * the user has granted notification permission. The SW caches the app shell
 * and select API GETs so the POS keeps working under a flaky connection.
 *
 * Registration is a no-op in dev or when the worker is already active.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Skip in dev unless explicitly enabled (Next.js rebuilds invalidate the
    // cache constantly and the SW gets in the way).
    if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_SW_DEV) return;

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  }, []);

  return null;
}
