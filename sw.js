var CACHE = "cn-dsx02-v25";
var ASSETS = ["./", "./index.html", "./app_script.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.allSettled(ASSETS.map(function(u) { return c.add(u); }));
    })
  );
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(ks) {
      return Promise.all(
        ks.map(function(k) {
          if (k !== CACHE) return caches.delete(k);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Network-First strategy: Always fetch fresh resources from server when online; fallback to cache when offline
self.addEventListener("fetch", function(e) {
  var u = new URL(e.request.url);
  if (u.hostname.indexOf("script.google") >= 0 || u.hostname.indexOf("googleusercontent") >= 0) return;
  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request)
      .then(function(resp) {
        if (resp && resp.status === 200) {
          var cp = resp.clone();
          caches.open(CACHE).then(function(c) {
            c.put(e.request, cp);
          });
        }
        return resp;
      })
      .catch(function() {
        return caches.match(e.request).then(function(r) {
          return r || (e.request.mode === "navigate" ? caches.match("./index.html") : null);
        });
      })
  );
});
