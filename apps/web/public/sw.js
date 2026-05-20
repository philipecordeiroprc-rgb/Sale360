// Sale360 Service Worker — PWA Offline Support
// Strategy: Network-first for navigations, Cache-first for static assets.
// When offline, serves the cached app shell so React boots and uses IndexedDB data.

const SHELL_CACHE = 'sale360-shell-v1';
const STATIC_CACHE = 'sale360-static-v1';

// Serve the offline page (inline HTML that tries to boot the app)
function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Sale360</title>
<style>
  body{background:#0F172A;color:#E2E8F0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:1rem}
  .card{background:#1E293B;border-radius:16px;padding:2rem;max-width:360px;width:100%}
  h1{color:#fff;font-size:1.25rem;margin:1rem 0 .5rem}
  p{color:#94A3B8;font-size:.875rem;line-height:1.5;margin:0 0 1.5rem}
  .icon{width:48px;height:48px;background:#6366F1;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem}
  button{background:#6366F1;color:#fff;border:none;padding:.75rem 1.5rem;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer}
  button:hover{background:#5558E6}
</style>
</head>
<body>
<div class="card">
  <div class="icon">&#9783;</div>
  <h1>Sem conex&atilde;o</h1>
  <p>Os dados do app ainda n&atilde;o foram baixados. Conecte-se &agrave; internet para carregar o Sale360 pela primeira vez.</p>
  <button onclick="location.reload()">Tentar novamente</button>
</div>
</body></html>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

// Install — pre-cache the root page so app can boot offline immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const urls = ['/'];
      for (const url of urls) {
        try {
          const resp = await fetch(url, { credentials: 'same-origin' });
          if (resp.ok) {
            cache.put(url, resp);
          }
        } catch {
          // Will be cached on first successful navigation
        }
      }
    }),
  );
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

// Helper: try to serve any cached page as app shell
async function serveAppShell(request) {
  // First, try exact URL match
  const exactMatch = await caches.match(request);
  if (exactMatch) return exactMatch;

  // Then try key pages in order
  const shell = await caches.open(SHELL_CACHE);
  const keys = await shell.keys();

  // Try common pages first
  const preferredUrls = ['/dashboard', '/orders', '/products', '/customers', '/'];
  for (const url of preferredUrls) {
    const cached = await shell.match(url);
    if (cached) return cached;
  }

  // Fallback: any cached page
  for (const req of keys) {
    const cached = await shell.match(req);
    if (cached) return cached;
  }

  // Nothing cached at all
  return null;
}

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Static assets (hashed) — cache first, network fallback
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        }),
      ),
    );
    return;
  }

  // Navigation — network first, fallback to cached app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { credentials: 'same-origin' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            // Cache the response for this URL
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await serveAppShell(request);
          return cached || offlinePage();
        }),
    );
    return;
  }

  // Other same-origin GETs (API calls are cross-origin, not handled) — network only
});
