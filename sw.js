var CACHE='cn-dsx02-v1';
var ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',function(e){ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS).catch(function(){});})); });
self.addEventListener('activate',function(e){ e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){if(k!==CACHE)return caches.delete(k);}));})); self.clients.claim(); });
self.addEventListener('fetch',function(e){
  var u=new URL(e.request.url);
  if(u.hostname.indexOf('script.google')>=0 || u.hostname.indexOf('googleusercontent')>=0) return; // luôn gọi mạng cho đồng bộ
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request).then(function(resp){ var cp=resp.clone(); caches.open(CACHE).then(function(c){c.put(e.request,cp);}); return resp; }).catch(function(){ return caches.match('./index.html'); }); }));
});
