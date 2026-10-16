// Bump CACHE_VERSION when you change files, so old caches are removed.
// Strategy: network-first for same-origin GET requests (edits show up immediately),
// falling back to the cache when offline. Only the app shell is cached - never your data (that lives in IndexedDB).
const CACHE_VERSION = 'v3';
const CACHE = `focus-tracker-${CACHE_VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/app-icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './css/activities.css',
  './css/components.css',
  './css/contributions.css',
  './css/dashboard.css',
  './css/layout.css',
  './css/reset.css',
  './css/responsive.css',
  './css/settings.css',
  './css/statistics.css',
  './css/timer.css',
  './css/variables.css',
  './js/app.js',
  './js/database.js',
  './js/file-check.js',
  './js/router.js',
  './js/state.js',
  './js/utils.js',
  './js/components/confirmation.js',
  './js/components/modal.js',
  './js/components/navigation.js',
  './js/components/notifications.js',
  './js/modules/activities.js',
  './js/modules/contributions.js',
  './js/modules/dashboard.js',
  './js/modules/export-import.js',
  './js/modules/goals.js',
  './js/modules/notifications.js',
  './js/modules/sessions.js',
  './js/modules/settings.js',
  './js/modules/statistics.js',
  './js/modules/timer.js',
  './assets/vendor/fontawesome/css/fontawesome.min.css',
  './assets/vendor/fontawesome/css/solid.min.css',
  './assets/vendor/fontawesome/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('focus-tracker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
});
