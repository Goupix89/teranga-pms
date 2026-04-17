const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output.buffer as ArrayBuffer;
}

export async function requestNotificationPermission(): Promise<{ endpoint: string; auth: string; p256dh: string } | null> {
  try {
    if (typeof window === 'undefined') return null;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    if (!VAPID_PUBLIC_KEY) {
      console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
      return null;
    }

    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const swRegistration = await navigator.serviceWorker.ready;

    // Reuse existing subscription if available (avoids push service rate-limit errors)
    let subscription = await swRegistration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string;
      keys: { auth: string; p256dh: string };
    };

    return { endpoint, auth: keys.auth, p256dh: keys.p256dh };
  } catch (err) {
    console.error('Failed to register Web Push subscription:', err);
    return null;
  }
}

export function onForegroundMessage(_callback: (payload: any) => void) {
  // Web Push notifications are handled by the service worker
}
