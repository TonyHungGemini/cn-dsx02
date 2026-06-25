var CACHE='cn-dsx02-v6';
var ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  './images-1.js','./images-2.js','./images-3.js','./images-4.js'];
self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.allSettled(ASSETS.map(function(u){return c.add(u);}));
  }));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){if(k!==CACHE)return caches.delete(k);}));}));
  self.clients.claim();
});
self.addEventListener('fetch',function(e){
  var u=new URL(e.request.url);
  if(u.hostname.indexOf('script.google')>=0 || u.hostname.indexOf('googleusercontent')>=0) return;
  if(e.request.method!=='GET') return;
  var isDoc = e.request.mode==='navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('index.html');
  if(isDoc){
    e.respondWith(
      fetch(e.request).then(function(resp){ var cp=resp.clone(); caches.open(CACHE).then(function(c){c.put(e.request,cp);}); return resp; })
      .catch(function(){ return caches.match(e.request).then(function(r){ return r || caches.match('./index.html'); }); })
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(function(r){
        return r || fetch(e.request).then(function(resp){ var cp=resp.clone(); caches.open(CACHE).then(function(c){c.put(e.request,cp);}); return resp; });
      })
    );
  }
});
