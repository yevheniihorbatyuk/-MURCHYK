const CACHE_NAME = 'murchyk-v2.0.0';
const STATIC_CACHE = 'murchyk-static-v2.0.0';
const DYNAMIC_CACHE = 'murchyk-dynamic-v2.0.0';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/murchyk.png',
  '/metadata/jetton.json',
  // External resources
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css',
  'https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js',
  'https://cdnjs.cloudflare.com/ajax/libs/particles.js/2.0.0/particles.min.js'
];

// Files that can be cached dynamically
const DYNAMIC_FILES = [
  'https://tonviewer.com/',
  'https://t.me/obreey_space',
  'https://www.instagram.com/obreey_space/',
  'https://www.instagram.com/catlandia_obreey/'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
      caches.open(DYNAMIC_CACHE) // Create dynamic cache
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting(); // Immediately activate new SW
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - serve cached files or fetch from network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', event.request.url);
        return cachedResponse;
      }

      // Otherwise fetch from network
      console.log('[SW] Fetching from network:', event.request.url);
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone response for caching
        const responseToCache = response.clone();
        
        // Cache dynamic content
        if (shouldCacheDynamically(event.request.url)) {
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // Fallback for offline scenarios
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
        
        // Return cached version if network fails
        return caches.match(event.request);
      });
    })
  );
});

// Helper function to determine if URL should be cached dynamically
function shouldCacheDynamically(url) {
  return DYNAMIC_FILES.some(pattern => url.includes(pattern)) ||
         url.includes('murchyk') ||
         url.includes('assets/') ||
         url.includes('metadata/');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      // Handle any offline actions when back online
      handleBackgroundSync()
    );
  }
});

function handleBackgroundSync() {
  // Could be used for offline form submissions, analytics, etc.
  return Promise.resolve();
}

// Push notification support
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');
  
  const options = {
    body: event.data ? event.data.text() : 'Нові новини від MURCHYK!',
    icon: '/assets/murchyk.png',
    badge: '/assets/murchyk.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Переглянути',
        icon: '/assets/murchyk.png'
      },
      {
        action: 'close',
        title: 'Закрити'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('MURCHYK Token', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    event.ports[0].postMessage({
      caches: [STATIC_CACHE, DYNAMIC_CACHE],
      version: 'v2.0.0'
    });
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'murchyk-updates') {
    event.waitUntil(
      checkForUpdates()
    );
  }
});

async function checkForUpdates() {
  // Could check for token price updates, new airdrops, etc.
  try {
    const response = await fetch('/metadata/jetton.json');
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put('/metadata/jetton.json', response.clone());
      console.log('[SW] Updated token metadata');
    }
  } catch (error) {
    console.log('[SW] Failed to update metadata:', error);
  }
}