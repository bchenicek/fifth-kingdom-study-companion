/* Service worker: precaches the whole app so it works with no signal. */
const VERSION = '6103d222d600';
const CACHE = 'fk-' + VERSION;
const FILES = ["./", "index.html", "app.css", "app.js", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "content/index.json", "content/ch01.json", "content/ch02.json", "content/ch03.json", "content/ch04.json", "content/ch05.json", "content/ch06.json", "content/ch07.json", "content/ch08.json", "content/ch09.json", "content/ch10.json", "content/ch11.json", "content/ch12.json", "content/ch13.json", "content/ch14.json", "content/ch15.json", "content/ch16.json", "content/ch17.json", "content/ch18.json", "content/ch19.json", "content/ch20.json", "content/ch21.json", "content/ch22.json", "content/ch23.json", "content/ch24.json", "content/ch25.json"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('fk-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (e.request.mode === 'navigate') return c.match('./index.html').then((r) => r || fetch(e.request));
      return fetch(e.request);
    }))
  );
});
