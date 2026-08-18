const CACHE="icp-reporter-v5.16.1";
const ASSETS=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png"];

self.addEventListener("install",e=>{
  // NOTE: no skipWaiting() here — the new worker WAITS until the user clicks
  // "Update now" in the app, which posts SKIP_WAITING (see below).
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
});

// the page tells us to activate immediately when the user accepts the update
self.addEventListener("message",e=>{ if(e.data && e.data.type==="SKIP_WAITING") self.skipWaiting(); });

// Drop every cache from a previous version so a release can never be shadowed by stale files.
self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// Network-first for the app itself (so updates land on next launch), cache-first for icons.
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET") return;
  const isDoc = req.mode==="navigate" || /\.(html|json|js)$/.test(new URL(req.url).pathname);
  if(isDoc){
    e.respondWith(
      fetch(req)
        .then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}); return res; })
        .catch(()=>caches.match(req).then(r=>r||caches.match("./index.html")))
    );
  } else {
    e.respondWith(caches.match(req).then(r=>r||fetch(req)));
  }
});
