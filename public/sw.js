const CACHE_NAME = 'galaxy-legend-v2';
const INDEX_PATH = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        const indexUrl = new URL(INDEX_PATH, self.registration.scope).href;
        const scopeUrl = new URL('./', self.registration.scope).href;
        const response = await fetch(indexUrl, { cache: 'no-cache' });

        const html = await response.clone().text();
        await cache.put(indexUrl, response.clone());
        await cache.put(scopeUrl, response.clone());

        // 预缓存 index.html 里引用的 JS/CSS/图标，第一次访问后即可离线打开。
        const urls = new Set();
        for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
          const raw = match[1];
          if (/^(?:https?:|data:|#)/.test(raw)) continue;
          urls.add(new URL(raw, indexUrl).href);
        }

        await Promise.all(
          [...urls].map(async (url) => {
            try {
              await cache.add(new Request(url, { cache: 'reload' }));
            } catch {
              // 单个资源失败不影响整体安装。
            }
          }),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航走网络优先，保证更新后能拿到新的 index.html。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(
              (cached) =>
                cached ||
                caches.match(new URL(INDEX_PATH, self.registration.scope).href),
            ),
        ),
    );
    return;
  }

  // 静态资源带 hash，可以优先用缓存；后台顺便更新。
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
