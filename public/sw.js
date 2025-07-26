const CACHE_NAME = 'bevpro-pos-v1';
const STATIC_CACHE_NAME = 'bevpro-static-v1';
const DYNAMIC_CACHE_NAME = 'bevpro-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/favicon.ico',
  '/chime.mp3',
  '/sounds/wake-ack.mp3'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Different strategies for different types of requests
  if (isStaticAsset(request.url)) {
    // Static assets - cache first
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(request.url)) {
    // API requests - network first with cache fallback
    event.respondWith(networkFirst(request));
  } else {
    // HTML pages - stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Check if request is for static assets
function isStaticAsset(url) {
  return url.includes('/_next/static/') || 
         url.includes('/static/') || 
         url.endsWith('.css') || 
         url.endsWith('.js') || 
         url.endsWith('.svg') || 
         url.endsWith('.png') || 
         url.endsWith('.jpg') || 
         url.endsWith('.jpeg') || 
         url.endsWith('.gif') || 
         url.endsWith('.webp') || 
         url.endsWith('.ico') || 
         url.endsWith('.mp3') || 
         url.endsWith('.wav');
}

// Check if request is for API
function isAPIRequest(url) {
  return url.includes('/api/');
}

// Cache first strategy
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    return new Response('Offline - Asset not available', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ 
      error: 'Offline - API not available',
      offline: true 
    }), { 
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    cache.put(request, networkResponse.clone());
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || await fetchPromise;
}

// Background sync for offline actions (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
      console.log('Service Worker: Background sync triggered');
      event.waitUntil(doBackgroundSync());
    }
  });
}

async function doBackgroundSync() {
  // Handle offline actions when back online
  console.log('Service Worker: Performing background sync');
  // This could sync offline orders, inventory updates, etc.
}

// Push notifications (if needed for order alerts)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Handle message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 