const CACHE_NAME = 'hrbtc-cache-v2';
// Local app files only — CDN resources are cached by browser HTTP cache
// No version pinning for external CDN in service worker (avoids stale versions)
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json'
];

// ขั้นตอน Install และทำการแคชไฟล์หน้าตาพื้นฐานแอป
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[HRBTC SW] Caching essential assets v2...');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[HRBTC SW] Failed to cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// ขั้นตอน Activate และล้างแคชอันเก่า
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[HRBTC SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ดักจับการส่งข้อมูลข้ามเครือข่าย เพื่อสแตนด์บายออฟไลน์
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache external CDN POST requests or non-GET
  if (request.method !== 'GET') return;

  // For Google API calls — always go network-first, never serve from cache
  if (url.hostname.includes('google') || url.hostname.includes('script.google')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return a minimal offline fallback for API calls
        return new Response(JSON.stringify({
          status: 'offline',
          message: 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาลองใหม่อีกครั้ง'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // For local assets and CDN — cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        // Cache successful responses for local files and CDN
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to cached index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
