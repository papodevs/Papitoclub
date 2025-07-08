const CACHE_NAME = 'papoclub-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/home.html',
  '/menu.html',
  '/perfil.html',
  '/historial.html',
  '/mensajes.html',
  '/home-app.js',
  '/style.css',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
];

// Instalar y guardar archivos en caché
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalado');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activación y limpieza de versiones antiguas del caché
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activado');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Interceptar solicitudes y usar caché si está disponible
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
