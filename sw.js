'use strict';
// Service worker của Khoảng đọc. BUILD_ID được scripts/build-pwa.cjs thay bằng mã băm nội dung khi deploy,
// nên mỗi lần nội dung đổi sẽ có sw.js khác byte và trình duyệt tự cập nhật. Chỉnh danh sách PRECACHE tại đây.
const BUILD_ID = '__BUILD_ID__';
const PRECACHE = [
  'index.html',
  'styles.css',
  'fonts.js',
  'sample.js',
  'formatter.js',
  'app.js',
  'pwa.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];
const PREFIX = 'khoang-doc-';
const CACHE = PREFIX + BUILD_ID;
const DEV = BUILD_ID.startsWith('__'); // chạy trực tiếp từ mã nguồn: không cache, luôn lấy bản mới
const scope = new URL('./', self.registration.scope).href;

self.addEventListener('install', event => {
  if (DEV) return event.waitUntil(self.skipWaiting());
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Tải đồng loạt, bỏ qua cache HTTP; thêm ?v= để CDN không trả bản cũ. Thiếu một file là hủy cả bản cập nhật.
    await Promise.all(PRECACHE.map(async file => {
      const url = new URL(file, scope).href;
      const response = await fetch(url + '?v=' + BUILD_ID, { cache: 'reload' });
      if (!response.ok) throw new Error(file + ' → HTTP ' + response.status);
      await cache.put(url, response.clone());
      if (file === 'index.html') await cache.put(scope, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (DEV || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith((async () => {
    // caches.match (không phải caches.open) để một request đến muộn không tạo lại cache rỗng của bản cũ.
    const hit = await caches.match(request, { cacheName: CACHE, ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(request); } catch (error) {
      // Mất mạng khi mở một địa chỉ trong phạm vi app (vd. đường dẫn lạ): hiện app thay vì trang lỗi.
      if (request.mode === 'navigate') { const app = await caches.match(scope, { cacheName: CACHE }); if (app) return app; }
      throw error;
    }
  })());
});
