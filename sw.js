// Service Worker بسيط — شرط أساسي عشان المتصفح يعتبر الموقع "قابل للتثبيت" (installable).
// مش بيعمل caching فعلي دلوقتي عشان منضمنش تعارض مع تحديثات الموقع أو المنتجات،
// بس وجوده ووجود fetch handler كافي عشان زرار "تثبيت التطبيق" يظهر للمستخدم.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // بيمر الطلبات زي ما هي من غير أي تعديل أو تخزين مؤقت.
  event.respondWith(fetch(event.request));
});
