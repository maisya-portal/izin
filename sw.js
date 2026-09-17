const CACHE_NAME = 'maisya-izin-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './icon.svg'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Hanya proses GET request dan abaikan endpoint eksternal
  if (e.request.method !== 'GET' || e.request.url.includes('script.google.com') || e.request.url.includes('api.qrserver.com') || e.request.url.includes('api.whatsapp.com')) {
    return;
  }
  
  // STRATEGI 1: NETWORK-FIRST untuk navigasi HTML (index.html / root)
  // Ini memastikan pengguna SELALU mendapatkan kode terbaru ketika online, dan hanya menggunakan cache jika offline.
  if (e.request.mode === 'navigate' || e.request.destination === 'document' || e.request.url.endsWith('/') || e.request.url.includes('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match(e.request);
        })
    );
    return;
  }

  // STRATEGI 2: STALE-WHILE-REVALIDATE untuk aset lokal lainnya (logo, icon, manifest)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
