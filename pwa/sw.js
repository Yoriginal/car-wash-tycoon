/* Service worker Car Wash Tycoon : hors-ligne + mises à jour.
   Deux canaux cohabitent sur le même site :
   - main    : le jeu, à la racine
   - preview : l'aperçu des versions en cours, dans /preview/
   Chaque canal a ses propres caches et ignore les pages de l'autre. */
const VERSION = '__VERSION__';
const CHANNEL = '__CHANNEL__';
const PREFIX = 'cwt-' + CHANNEL + '-';
const CACHE = PREFIX + VERSION;
const FONTS = 'cwt-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => (k.startsWith(PREFIX) && k !== CACHE) || /^cwt-[0-9a-f]{10}$/.test(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // polices Google : cache permanent partagé
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // le jeu principal ne gère jamais les pages de l'aperçu
  if (CHANNEL === 'main' && url.pathname.includes('/preview/')) return;
  // page : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html', { cacheName: CACHE }).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE }).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
});
