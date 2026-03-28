/* eslint-disable no-restricted-globals */
// Firebase Messaging Service Worker
// This file MUST be at the root of the public directory

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config — these are PUBLIC keys, safe to include in client code
firebase.initializeApp({
  apiKey: 'AIzaSyA4yieC3vHVif9E77dzWcewljP-f3giTVM',
  authDomain: 'teranga-pms.firebaseapp.com',
  projectId: 'teranga-pms',
  storageBucket: 'teranga-pms.firebasestorage.app',
  messagingSenderId: '858864118265',
  appId: '1:858864118265:web:d350bf97b37607a219f528',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Teranga PMS';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: payload.data || {},
    tag: payload.data?.notificationId || 'default',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.link || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if possible
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
