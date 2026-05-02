const CACHE_NAME = 'chattery-v5';
const STATIC_CACHE = 'chattery-static-v5';
const DYNAMIC_CACHE = 'chattery-dynamic-v5';

const STATIC_ASSETS = [
  '/',
  '/chat',
  '/login',
  '/register',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

const CACHE_STRATEGIES = {
  images: { strategy: 'cacheFirst', maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
  api: { strategy: 'networkFirst', maxAge: 5 * 60 * 1000 }, // 5 minutes
  assets: { strategy: 'staleWhileRevalidate', maxAge: 24 * 60 * 60 * 1000 } // 1 day
};

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching app shell and static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only cache GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Handle different types of requests with appropriate strategies
  if (request.url.includes('/api/')) {
    // API requests: Network first, fast fail to cache
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  } else if (request.url.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    // Images: Cache first with long expiry
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
  } else if (request.url.match(/\.(js|css|woff2|woff)$/)) {
    // Static assets: Stale while revalidate
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  } else if (request.mode === 'navigate') {
    // Navigation requests: Network first with offline fallback
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, '/offline.html'));
  } else {
    // Default: Network first fallback to cache
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Network first strategy
async function networkFirst(request, cacheName, fallbackUrl = null) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cacheResponse = await caches.match(request);
    if (cacheResponse) return cacheResponse;
    
    if (fallbackUrl) {
      return caches.match(fallbackUrl);
    }
    
    throw error;
  }
}

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cacheResponse = await caches.match(request);
  if (cacheResponse) return cacheResponse;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cacheResponse = await caches.match(request);
  
  const networkResponsePromise = fetch(request).then(async networkResponse => {
    if (networkResponse.status === 200) {
      // Clone BEFORE any other operations
      const responseClone = networkResponse.clone();
      const cache = await caches.open(cacheName);
      await cache.put(request, responseClone);
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, return cached version if available
    return cacheResponse;
  });
  
  return cacheResponse || await networkResponsePromise;
}

// Enhanced push notification handling
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'Chattery',
    body: 'Nieuw bericht',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    image: null,
    data: {
      url: '/chat',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Open chat',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Sluiten'
      }
    ],
    tag: 'chattery-message',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.error('Error parsing push data:', error);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event - Enhanced handling
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;
  
  if (action === 'close') {
    return; // Just close the notification
  }

  // Default action or 'open' action
  const urlToOpen = notificationData.url || '/chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // No existing window found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline message queue (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-message-sync') {
    event.waitUntil(
      // Handle offline message queue here
      console.log('Background sync triggered for messages')
    );
  }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
  
  // Track notification engagement analytics here if needed
});
