const CACHE='jornada-cacador-v78-smart-notebook-r172';
const ASSETS=['./','./index.html','./ui-v75.css','./ui-v77.css','./ui-v78.css','./v59-enhancements.js','./v77-experience.js','./v78-smart-notebook.js','./pdf-text-client.js','./pdf.mjs','./pdf.worker.mjs','./content-summaries.js','./native-question-bank.json','./material-deep-dives.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./login-banner.jpg',
  './login-banner.webp',
  './bancas-boss-banner.webp','./bancas-boss-banner.jpg','./og-banner-1200x630.jpg','./privacidade.html','./termos.html','./cookies.html','./404.html'];

const CACHE_PREFIX = 'jornada-cacador-';
const STATIC_PATHS = new Set(ASSETS.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  // Apenas os recursos públicos do aplicativo; não armazena endpoints arbitrários.
  if (!STATIC_PATHS.has(url.pathname) || url.search || e.request.headers.has('authorization')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isStaticMedia = /\.(jpe?g|png|svg|webp|woff2?|mjs)$/i.test(url.pathname);
    if (isStaticMedia) {
      const cached = await cache.match(e.request);
      if (cached) return cached;
    }
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.status === 200 && r.type==='basic') {
        await cache.put(e.request, r.clone()).catch(() => undefined);
      }
      return r;
    } catch {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      if (e.request.mode === 'navigate') {
        const shell = await cache.match(new URL('./index.html', self.registration.scope).href);
        if (shell) return shell;
      }
      return new Response('Recurso indisponível offline.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }
  })());
});
