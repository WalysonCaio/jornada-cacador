const CACHE='jornada-cacador-v78-smart-notebook-r193';
const ASSETS=['./','./index.html','./ui-v75.css','./ui-v77.css','./ui-v78.css','./ui-r184.css','./ui-r188.css','./questions-workspace.css','./questions-workspace.js','./progress-ledger.js','./question-text-quality.js','./question-availability.js','./exam-questions-client.js','./question-review.js','./invocador-classroom.js','./v59-enhancements.js','./question-session-store.js','./v77-experience.js','./v78-smart-notebook.js','./jc-architecture-modules.js','./pdf-text-client.js','./hunter-manuals.js','./hunter-manuals.css','./content-summaries.js','./native-question-bank.json','./native-laws-database.json','./material-deep-dives.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./login-banner.jpg',
  './login-banner.webp',
  './bancas-boss-banner.webp','./bancas-boss-banner.jpg','./og-banner-1200x630.jpg','./privacidade.html','./termos.html','./cookies.html','./404.html'];

// O leitor e o worker entram no cache após o primeiro uso bem-sucedido.
// A instalação do aplicativo não precisa baixar o motor de PDF antecipadamente.
const LAZY_ASSETS = ['./pdf.mjs', './pdf.worker.mjs'];
const CACHE_PREFIX = 'jornada-cacador-';
const NETWORK_TIMEOUT_MS = 3500;
const STATIC_PATHS = new Set([...ASSETS, ...LAZY_ASSETS].map(path => new URL(path, self.registration.scope).pathname));

async function fetchWithTimeout(request) {
  if (typeof AbortController === 'function' && typeof setTimeout === 'function' && typeof clearTimeout === 'function') {
    const controller = new AbortController();
    const timer = setTimeout(() => { try { controller.abort(); } catch {} }, NETWORK_TIMEOUT_MS);
    try {
      return await fetch(request, { cache: 'no-cache', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  return await fetch(request, { cache: 'no-cache' });
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event?.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
      const r = await fetchWithTimeout(e.request);
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
