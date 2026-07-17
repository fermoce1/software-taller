/* Service worker — Sanmy Taller App (icono en Android / iPhone) */
const CACHE = 'sanmy-app-v3';
const APP_SHELL = [
  '/app.html',
  '/icon.svg',
  '/img/app/icon-192.png',
  '/img/app/icon-512.png',
  '/img/inicio/logo-sanmy.png',
  '/lib/jsQR.js',
  '/lib/html5-qrcode.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // No cachear API ni páginas del taller (siempre del servidor en vivo)
  if (url.pathname.indexOf('/api/') === 0) return;
  if (/\.(html)$/i.test(url.pathname) && url.pathname !== '/app.html') return;

  var esShell =
    url.pathname === '/app.html' ||
    url.pathname === '/icon.svg' ||
    url.pathname.indexOf('/img/app/') === 0 ||
    url.pathname === '/img/inicio/logo-sanmy.png' ||
    url.pathname.indexOf('/lib/') === 0 ||
    url.pathname === '/manifest-app.webmanifest';

  if (!esShell) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var red = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copia = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copia);
          });
        }
        return res;
      }).catch(function () {
        return cached;
      });
      return cached || red;
    })
  );
});
