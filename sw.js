// Daily Digest — Service Worker v5
// Shell: network-first with 1-hour TTL → always picks up updates fast.
// Fonts: cache-first with 7-day TTL.
// Feeds/APIs: stale-while-revalidate, 30-min TTL.

const VERSION      = 'v5';
const SHELL_CACHE  = 'dd-shell-' + VERSION;
const FEED_CACHE   = 'dd-feeds-' + VERSION;
const FONT_CACHE   = 'dd-fonts-' + VERSION;
const SHELL_TTL_MS = 60 * 60 * 1000;        // 1 hour — shell always fresh
const FEED_TTL_MS  = 30 * 60 * 1000;        // 30 min
const FONT_TTL_MS  = 7 * 24 * 60 * 60 * 1000;

const FEED_HOSTS = [
  'api.rss2json.com','hacker-news.firebaseio.com','api.open-meteo.com',
  'en.wikipedia.org','ml.wikipedia.org','api.allorigins.win','corsproxy.io',
  'api.codetabs.com','thingproxy.freeboard.io'
];

// ── INSTALL — skip waiting immediately ───────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(self.skipWaiting());
});

// ── ACTIVATE — claim all clients, delete ALL old caches ──────
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

  // App shell (index.html, manifest) — network-first with TTL
  // This ensures updates are picked up within 1 hour max
  if (url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname.endsWith('manifest.json')) {
    e.respondWith(networkFirstWithTTL(e.request, SHELL_CACHE, SHELL_TTL_MS));
    return;
  }

  // Google Fonts — cache-first, long TTL
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirstWithTTL(e.request, FONT_CACHE, FONT_TTL_MS));
    return;
  }

  // Feed/API calls — stale-while-revalidate
  var isFeedHost = FEED_HOSTS.some(function(h) { return url.hostname === h; });
  if (isFeedHost) {
    e.respondWith(staleWhileRevalidate(e.request, FEED_CACHE, FEED_TTL_MS));
    return;
  }

  // Everything else — network, cache as offline fallback
  e.respondWith(networkWithCacheFallback(e.request, FEED_CACHE));
});

// ── STRATEGIES ────────────────────────────────────────────────

// Network-first: try network; if fresh enough serve cached; on fail serve stale
function networkFirstWithTTL(request, cacheName, ttl) {
  return caches.open(cacheName).then(function(cache) {
    return fetch(request).then(function(response) {
      if (response.ok) {
        var headers = new Headers(response.headers);
        headers.set('sw-cache-date', Date.now().toString());
        var tagged = new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers });
        cache.put(request, tagged.clone());
        return tagged;
      }
      return response;
    }).catch(function() {
      // Offline — serve from cache regardless of TTL
      return cache.match(request);
    });
  });
}

function cacheFirstWithTTL(request, cacheName, ttl) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) {
        var d = cached.headers.get('sw-cache-date');
        if (d && (Date.now() - parseInt(d)) < ttl) return cached;
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
      }).catch(function() { return cached; });
    });
  });
}

function staleWhileRevalidate(request, cacheName, ttl) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var isStale = true;
      if (cached) {
        var d = cached.headers.get('sw-cache-date');
        isStale = !d || (Date.now() - parseInt(d)) >= ttl;
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
      if (cached && !isStale) { networkFetch; return cached; }
      return networkFetch.then(function(r) { return r || cached; });
    });
  });
}

function networkWithCacheFallback(request, cacheName) {
  return fetch(request).then(function(response) {
    if (response.ok) caches.open(cacheName).then(function(c) { c.put(request, response.clone()); });
    return response;
  }).catch(function() {
    return caches.open(cacheName).then(function(c) { return c.match(request); });
  });
}
