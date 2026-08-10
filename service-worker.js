// Two separate caches, bumped independently:
//
// CORE_CACHE  — index.html / style.css / app.js / manifest.json.
//               These change often during development, so they are
//               fetched network-first (always get the latest when
//               online) and only fall back to cache when offline.
//               Bump CORE_CACHE's version whenever any of these files
//               change.
//
// ASSET_CACHE — icons and the piano sample sounds. These are large
//               (the samples are ~850KB) but essentially never change,
//               so they're cache-first: fetched from the network only
//               once, then served from cache forever after — even
//               after CORE_CACHE is bumped for an unrelated code
//               update. Only bump ASSET_CACHE's version if the icons
//               or sample sounds themselves are replaced.
var CORE_CACHE = "kids-piano-core-v8";
var ASSET_CACHE = "kids-piano-assets-v1";

var CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

var STATIC_ASSETS = [
  "./icons/icon-120.png",
  "./icons/icon-152.png",
  "./icons/icon-167.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./samples/C3.mp3",
  "./samples/Ds3.mp3",
  "./samples/Fs3.mp3",
  "./samples/A3.mp3",
  "./samples/C4.mp3",
  "./samples/Ds4.mp3",
  "./samples/Fs4.mp3",
  "./samples/A4.mp3",
  "./samples/C5.mp3",
  "./samples/Ds5.mp3",
  "./samples/Fs5.mp3",
  "./samples/A5.mp3",
  "./samples/C6.mp3"
];

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
    Promise.all([
      caches.open(CORE_CACHE).then(function (cache) { return cache.addAll(CORE_ASSETS); }),
      caches.open(ASSET_CACHE).then(function (cache) { return cache.addAll(STATIC_ASSETS); })
    ])
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  var keep = [CORE_CACHE, ASSET_CACHE];
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return keep.indexOf(key) === -1; })
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
            caches.open(CORE_CACHE).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request, { cacheName: CORE_CACHE }).then(function (cached) {
            return cached || caches.match("./index.html", { cacheName: CORE_CACHE });
          });
        })
    );
    return;
  }

  // Icons + piano samples: cache-first, since they don't change.
  event.respondWith(
    caches.match(event.request, { cacheName: ASSET_CACHE }).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(ASSET_CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});
