// Bump this version string whenever any cached file changes,
// so devices pick up the update instead of serving an old cache.
var CACHE_NAME = "kids-piano-v4";

var ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-120.png",
  "./icons/icon-152.png",
  "./icons/icon-167.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Core files change as the app is developed, so they must always be
// re-checked against the network when online (network-first). Only
// when offline do they fall back to whatever was last cached. This
// prevents a stale style.css/app.js ever being paired with a newer
// index.html (or vice versa), which is what causes a broken layout.
var CORE_FILENAMES = ["index.html", "style.css", "app.js", "manifest.json"];

function isCoreFile(url) {
  if (url.pathname.endsWith("/")) return true; // "./" (the app's start page)
  for (var i = 0; i < CORE_FILENAMES.length; i++) {
    if (url.pathname.endsWith("/" + CORE_FILENAMES[i])) return true;
  }
  return false;
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  var url = new URL(event.request.url);
  var isNavigation = event.request.mode === "navigate";

  if (isNavigation || isCoreFile(url)) {
    // Network-first: always try to get the latest file when online.
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // Everything else (icons, etc.) rarely changes: cache-first is fine.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});
