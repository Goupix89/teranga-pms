const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output.buffer as ArrayBuffer;
}

/**
 * Request notification permission and register a Web Push subscription.
 * Sends the subscription to the backend for storage.
 * Returns true on success, false on failure.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    if (!VAPID_PUBLIC_KEY) {
      console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
      return false;
    }

    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const swRegistration = await navigator.serviceWorker.ready;

    // Clear stale subscription before creating a new one
    const existing = await swRegistration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string;
      keys: { auth: string; p256dh: string };
    };

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    const res = await fetch(`${apiUrl}/api/notifications/device-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ platform: 'WEB', endpoint, auth: keys.auth, p256dh: keys.p256dh }),
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to register Web Push subscription:', err);
    return false;
  }
}

/**
 * Listen for foreground push messages (shown by the service worker).
 * No-op in the Web Push approach — all notifications are handled by the SW.
 */
export function onForegroundMessage(_callback: (payload: any) => void) {
  // Web Push notifications are always handled by the service worker
}
