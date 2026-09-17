// Minimal service worker for PWA recognition.
// No caching and no fetch interception - just exists to enable PWA features.

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients immediately
  event.waitUntil(self.clients.claim());
});

// Do not intercept fetch requests. A pass-through respondWith(fetch()) here adds a
// service worker round-trip to every module load and turns transient network failures
// into hard ERR_FAILED errors. Leaving fetches untouched keeps PWA install eligibility
// without the failure amplification.
