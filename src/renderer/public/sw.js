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
// Skip socket.io requests to avoid interfering with long-polling transport
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('socket.io')) {
    return;
  }
  event.respondWith(fetch(event.request));
});
