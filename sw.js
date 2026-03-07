// Daily Digest — Service Worker
// Strategy: Cache-first for app shell & fonts, Stale-While-Revalidate for API calls
// Feed cache TTL: 30 minutes. Fonts/shell: indefinite (versioned).

const VERSION = 'v3';
const SHELL_CACHE  = 'dd-shell-' + VERSION;
const FEED_CACHE   = 'dd-feeds-' + VERSION;
const FONT_CACHE   = 'dd-fonts-' + VERSION;

const FEED_TTL_MS  = 30 * 60 * 1000; // 30 minutes
const FONT_TTL_MS  = 7  * 24 * 60 * 60 * 1000; // 7 days

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json'
];

const FEED_HOSTS = [
  'api.rss2json.com',
  'hacker-news.firebaseio.com',
  'api.open-meteo.com',
  'en.wikipedia.org',
  'ml.wikipedia.org',
  'api.allorigins.win',
  'corsproxy.io'
];

// ── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function(cache) {
      return cache.addAll(SHELL_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE — clean old caches ───────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) {
          return k !== SHELL_CACHE && k !== FEED_CACHE && k !== FONT_CACHE;
        }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // 1. App shell — cache first, network fallback
  if (url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname.endsWith('manifest.json')) {
    e.respondWith(cacheFirst(e.request, SHELL_CACHE));
    return;
  }

  // 2. Google Fonts — cache first with long TTL
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirstWithTTL(e.request, FONT_CACHE, FONT_TTL_MS));
    return;
  }

  // 3. Feed/API calls — stale-while-revalidate with 30 min TTL
  var isFeedHost = FEED_HOSTS.some(function(h) { return url.hostname === h; });
  if (isFeedHost) {
    e.respondWith(staleWhileRevalidate(e.request, FEED_CACHE, FEED_TTL_MS));
    return;
  }

  // 4. Everything else — network with cache fallback
  e.respondWith(networkWithCacheFallback(e.request, FEED_CACHE));
});

// ── STRATEGIES ────────────────────────────────────────────────

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

function cacheFirstWithTTL(request, cacheName, ttl) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) {
        var dateHeader = cached.headers.get('sw-cache-date');
        if (dateHeader && (Date.now() - parseInt(dateHeader)) < ttl) {
          return cached;
        }
      }
      return fetch(request).then(function(response) {
        if (response.ok) {
          var headers = new Headers(response.headers);
          headers.set('sw-cache-date', Date.now().toString());
          var tagged = new Response(response.body, { status: response.status, headers: headers });
          cache.put(request, tagged.clone());
          return tagged;
        }
        return cached || response;
      }).catch(function() {
        return cached;
      });
    });
  });
}

function staleWhileRevalidate(request, cacheName, ttl) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var isStale = true;
      if (cached) {
        var dateHeader = cached.headers.get('sw-cache-date');
        isStale = !dateHeader || (Date.now() - parseInt(dateHeader)) >= ttl;
      }

      var networkFetch = fetch(request).then(function(response) {
        if (response.ok) {
          var headers = new Headers(response.headers);
          headers.set('sw-cache-date', Date.now().toString());
          var tagged = new Response(response.body, { status: response.status, headers: headers });
          cache.put(request, tagged.clone());
          return tagged;
        }
        return response;
      }).catch(function() { return null; });

      // If we have a fresh cache hit, return it immediately and revalidate in background
      if (cached && !isStale) {
        networkFetch; // background revalidate
        return cached;
      }
      // Stale or missing — wait for network, fall back to stale cache
      return networkFetch.then(function(r) { return r || cached; }).then(function(r) {
        if (!r) throw new Error('offline and no cache');
        return r;
      });
    });
  });
}

function networkWithCacheFallback(request, cacheName) {
  return fetch(request).then(function(response) {
    if (response.ok) {
      caches.open(cacheName).then(function(cache) { cache.put(request, response.clone()); });
    }
    return response;
  }).catch(function() {
    return caches.open(cacheName).then(function(cache) { return cache.match(request); });
  });
}

// ── BACKGROUND SYNC — pre-warm critical feeds ─────────────────
// Fires when app is in background / device wakes up
self.addEventListener('periodicsync', function(e) {
  if (e.tag === 'prefetch-feeds') {
    e.waitUntil(prefetchCriticalFeeds());
  }
});

function prefetchCriticalFeeds() {
  var criticalFeeds = [
    'https://api.open-meteo.com/v1/forecast?latitude=48.1375&longitude=11.5755&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe%2FBerlin&forecast_days=3',
    'https://hacker-news.firebaseio.com/v0/topstories.json'
  ];
  return Promise.allSettled(criticalFeeds.map(function(url) {
    return fetch(url).then(function(r) {
      if (r.ok) {
        return caches.open(FEED_CACHE).then(function(cache) {
          var headers = new Headers(r.headers);
          headers.set('sw-cache-date', Date.now().toString());
          return cache.put(url, new Response(r.body, { headers: headers }));
        });
      }
    });
  }));
}
