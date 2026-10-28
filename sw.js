const V='20261028165303', C='trip-store';
const CORE=['./','index.html','app.js?v='+V,'app.css?v='+V,'manifest.json','icon.png','trips/index.json','trips/kyoto-2026.json'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>Promise.all(CORE.map(u=>fetch(u,{cache:'no-store'}).then(r=>{ if(r.ok) return c.put(new Request(u.split('?')[0]),r); }).catch(()=>{})))).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(self.clients.claim()); });
// 네트워크 우선, 실패하면 캐시(버전 쿼리 무시). 성공하면 캐시 갱신 → 오프라인에서도 마지막 버전으로 뜸
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(u.origin!==location.origin||e.request.method!=='GET') return;
  const key=new Request(u.origin+u.pathname);
  e.respondWith((async()=>{ try{ const r=await fetch(e.request,{cache:'no-store'}); if(r.ok){ const c=await caches.open(C); c.put(key,r.clone()); } return r; }
    catch(err){ const c=await caches.open(C); const m=await c.match(key)||await c.match(e.request,{ignoreSearch:true}); if(m) return m; if(e.request.mode==='navigate'){ const idx=await c.match(new Request(u.origin+'/index.html'))||await c.match(new Request(u.origin+'/')); if(idx) return idx; } throw err; } })());
});
