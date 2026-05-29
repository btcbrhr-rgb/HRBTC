const CACHE_NAME = 'hrbtc-cache-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// ขั้นตอน Install และทำการแคชไฟล์หน้าตาพื้นฐานแอป
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching essential assets...');
      return cache.addAll(ASSETS_TO_CACHE);
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
            console.log('Clearing old cache...', cache);
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
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // คืนค่าแคชที่บันทึกไว้ หรือทำการดึงข้อมูลจากเครือข่ายอินเทอร์เน็ตจริง
      return cachedResponse || fetch(event.request).catch(() => {
        // กรณีออฟไลน์และไฟล์ไม่มีในแคช สามารถเพิ่มหน้าแจ้งปิดอินเทอร์เน็ตสำรองได้ที่นี่
      });
    })
  );
});
