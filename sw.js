// Ao publicar uma versão nova do hub não é preciso mexer aqui:
// as páginas do próprio site são buscadas na rede primeiro (o cache só vale sem internet).
const CACHE_NAME = 'cbl-suite-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;
  const url = new URL(req.url);

  // Arquivos do próprio hub: rede primeiro; sem internet, usa a última cópia guardada.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(new Request(req, { cache: 'no-store' }))
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Bibliotecas de fora (Tailwind, ícones, fontes): usa a cópia guardada e atualiza por trás.
  if (/(^|\.)cdn\.tailwindcss\.com$|(^|\.)cdnjs\.cloudflare\.com$/.test(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const rede = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || rede;
      })
    );
  }
});
