// Minimal service worker for PWA recognition
// No caching - just exists to enable PWA features

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients immediately
  event.waitUntil(self.clients.claim());
});

// Pass through all fetch requests without caching
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
