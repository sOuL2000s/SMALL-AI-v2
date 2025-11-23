const CACHE_NAME = 'small-ai-v2-cache-v2.7'; // Increment this version number when you make significant changes to cached assets!
const urlsToCache = [
    '/', // The root HTML page
    'index.html', // The specific HTML file
    'manifest.json',
    'logo.png', // The application icon

    // External CDN resources - crucial for offline functionality
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdn.jsdelivr.net/npm/lucide-dynamic@latest/dist/lucide.min.js',
    'https://unpkg.com/lucide@latest'
];

// Install event: caches all defined static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing and caching static assets...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Service Worker: Cache.addAll failed', error);
            })
    );
});

// Activate event: cleans up old caches, ensuring only the current version is active
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating and cleaning old caches...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        }).then(() => {
            // Ensure the service worker takes control of clients immediately
            return self.clients.claim();
        })
    );
});

// Fetch event: intercepts network requests
self.addEventListener('fetch', (event) => {
    // We only want to handle GET requests for static assets that we can cache.
    // Dynamic API requests (like Gemini's generateContent) should always go to the network
    // and are typically POST requests, so they won't be affected by this caching strategy.
    
    // Convert the request URL to a URL object for easier comparison
    const requestUrl = new URL(event.request.url);

    // Check if the request is for a file we intend to cache
    // This includes both local files and CDN resources
    const isCacheableAsset = urlsToCache.some(url => {
        // For root path and index.html, compare href directly
        if (url === '/' || url === 'index.html') {
            return requestUrl.pathname === '/' || requestUrl.pathname === '/index.html';
        }
        // For other local assets (like manifest.json, logo.png), compare paths
        if (!url.startsWith('http')) {
            return requestUrl.pathname === `/${url}`;
        }
        // For CDN assets, check if the request URL starts with the cached URL
        return requestUrl.href.startsWith(url);
    });

    if (event.request.method === 'GET' && isCacheableAsset) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - return cached response
                    if (response) {
                        console.log('Service Worker: Serving from cache:', event.request.url);
                        return response;
                    }
                    // No cache hit - fetch from network
                    console.log('Service Worker: Fetching from network:', event.request.url);
                    return fetch(event.request)
                        .then((networkResponse) => {
                            // If we get a valid response, clone it and put it in cache
                            if (networkResponse && networkResponse.ok) {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                            }
                            return networkResponse;
                        })
                        .catch((error) => {
                            // If network fails and no cached response, log error
                            console.error('Service Worker: Fetch failed for:', event.request.url, error);
                            // Optionally, serve an offline fallback page here for critical assets
                            // For a chat app, if the main HTML can't load, a basic offline message is useful.
                            // If you have a specific offline.html, you can return caches.match('/offline.html');
                            // For simplicity, we'll just return a basic "You're offline" response.
                            return new Response('<h1>You are offline!</h1><p>It looks like you\'re not connected to the internet.</p>', {
                                headers: { 'Content-Type': 'text/html' }
                            });
                        });
                })
        );
    } else {
        // For all other requests (e.g., POST requests, API calls, unlisted assets), go straight to the network
        event.respondWith(fetch(event.request));
    }
});