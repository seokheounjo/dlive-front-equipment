// Service Worker for D'LIVE Mobile CONA PWA
const CACHE_NAME = 'dlive-cona-v3';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Install v3');
  self.skipWaiting();
});

// Activate event - 이전 캐시 모두 삭제
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate v3 - clearing old caches');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Push event - 서버에서 보낸 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  let data = { title: "D'LIVE 알림", body: '새로운 알림이 있습니다.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click - 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click');
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
