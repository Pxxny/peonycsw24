/* =========================================================
   CSW24 Word Lab — sw.js (Service Worker)
   =========================================================
   Purpose: make the app usable with no internet connection,
   after it has been opened at least once while online.

   Strategy:
   - PRECACHE (on install): every local file the app needs —
     index.html, css, and all js/ files including words-data.js
     (the CSW24 dictionary itself, ~3MB, already local — this
     just guarantees it's cached even if the browser's normal
     HTTP cache would otherwise evict it).
   - RUNTIME CACHE for third-party CDN assets (fonts, Bootstrap,
     Chart.js, etc.): cache-first once fetched successfully, so
     the FIRST load must be online (to fetch these once), but
     every load after that — online or offline — reads from
     cache. This app never modifies those files, so serving a
     cached copy indefinitely is correct, not stale.
   - LOCAL APP FILES use a "cache-first, refresh in background"
     (stale-while-revalidate) strategy: instant offline load
     from cache, while quietly checking the network for a newer
     version to use next time — so editing/updating the app's
     own files (this project's future updates) is still picked
     up on the next online visit without needing to bump a
     version number by hand.
   - Live API calls this app makes at runtime (e.g. the free
     dictionary definition lookup) are intentionally NOT
     cached and NOT intercepted — those need a real network
     connection every time by design, and app.js already fails
     silently/gracefully when they're unreachable offline.

   Nothing here changes what the app does — only whether its
   own files and CDN libraries can still be loaded with no
   network.
   ========================================================= */

const PRECACHE_NAME = 'csw24-precache-v1';
const RUNTIME_NAME = 'csw24-runtime-v1';

// Every local file the app needs to boot and run fully.
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/words-data.js',
  './js/browse-worker.js',
  './js/achievement.js',
  './js/badges.js',
  './js/AdaptiveQuiz.js',
  './js/CoachAdaptiveLoop.js',
  './js/CoachCharts.js',
  './js/CoachEngine.js',
  './js/CoachInsightsPanel.js',
  './js/CoachMistakesPanel.js',
  './js/CoachPlanPanel.js',
  './js/CoachSearchIndex.js',
  './js/CoachUI.js',
  './js/OddsTrainer.js',
  './js/PerformanceAnalyzer.js',
  './js/RecommendationEngine.js',
  './js/RetentionHeatmap.js',
  './js/SpacedRepetition.js',
  './js/WeaknessDetector.js',
  './js/BoardSystem/BoardSystems.js',
  './js/BoardSystem/BotSystem.js',
  './js/BoardSystem/PlayGame.js',
  './js/BoardSystem/RackManage.js'
];

// Runtime-call endpoints this app hits at USE time (not app files) that
// must always go to the network — never intercepted or cached, since a
// stale cached response would be actively wrong (a different word's
// definition) rather than just old.
const NEVER_CACHE_HOSTS = ['api.dictionaryapi.dev'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then(function (cache) {
      // addAll fails the whole install if ANY single URL 404s — fetch
      // individually instead so one missing/renamed file never blocks
      // every other file from being cached.
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[sw] precache skipped (not found):', url, err);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== PRECACHE_NAME && key !== RUNTIME_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isNeverCacheUrl(url) {
  return NEVER_CACHE_HOSTS.some(function (host) { return url.hostname === host; });
}

// Cache-first, refresh-in-background: return the cached copy immediately
// if present (fast, works offline), and in parallel fetch a fresh copy to
// store for next time. Used for the app's OWN files.
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      const network = fetch(request).then(function (response) {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(function () {
        // Offline and nothing cached yet for this file — nothing more we
        // can do; let the caller's cached-or-undefined result stand.
        return cached;
      });
      return cached || network;
    });
  });
}

// Cache-first, network-fallback-and-store: for third-party CDN libraries
// that this app never modifies, so a cached copy is always correct — no
// need to re-check the network once we have it.
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept POST/PUT etc.

  const url = new URL(req.url);

  if (isNeverCacheUrl(url)) return; // let this hit the network untouched

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, PRECACHE_NAME));
  } else {
    // Third-party CDN (fonts, Bootstrap, Chart.js, etc.) and ESM imports.
    event.respondWith(cacheFirst(req, RUNTIME_NAME));
  }
});
