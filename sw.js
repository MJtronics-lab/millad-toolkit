const CACHE_NAME = 'toolkit-v7';
const ASSETS = [
  './',
  './index.html',
  './tagesplan.html',
  './checkliste.html',
  './erinnerungen.html',
  './statistik.html',
  './shared.js',
  './notifications.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Don't cache API calls to push server
  if (event.request.url.includes('push.mjtronics.de')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Push notifications from server
self.addEventListener('push', event => {
  let data = { title: 'Millads Toolkit', body: 'Neue Erinnerung' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'toolkit',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/',
    },
  };

  if (data.actions) {
    options.actions = data.actions;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  let targetUrl = event.notification.data?.url || '/';

  // Handle action buttons
  if (event.action === 'open-checklist') {
    targetUrl = '/checkliste.html';
  }

  // Resolve relative URLs against the SW origin
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(fullUrl);
    })
  );
});
