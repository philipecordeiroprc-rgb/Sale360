// Sale360 Service Worker — PWA Offline Support
// Network-first for navigations, Cache-first for static assets

const SHELL_CACHE = 'sale360-shell-v1';
const STATIC_CACHE = 'sale360-static-v1';

// Install — activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate — clean old caches, take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Static assets (hashed) — cache first
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
          return cached || fetchPromise;
        }),
      ),
    );
    return;
  }

  // Navigation — network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            // Ultimate fallback — offline page
            return new Response(
              `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sale360 - Offline</title>
<style>body{background:#0F172A;color:#94A3B8;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:1rem}
h1{color:#fff;font-size:1.5rem;margin:.5rem 0} .logo{width:64px;height:64px;border-radius:16px;margin-bottom:.5rem}</style>
</head>
<body>
<div>
<img src="/icon-192.png" alt="Sale360" class="logo" onerror="this.style.display='none'">
<h1>Voc&ecirc; est&aacute; offline</h1>
<p>Conecte-se &agrave; internet e tente novamente.</p>
</div>
</body></html>`,
              { status: 503, headers: { 'Content-Type': 'text/html' } },
            );
          }),
        ),
    );
    return;
  }
});
