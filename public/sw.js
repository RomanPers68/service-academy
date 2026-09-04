/* Service Academy — сервис-воркер (Дополнение 173): приложение открывается без сети.
   Стратегия:
   • навигация (index.html): сеть первой, при отказе — сохранённая копия (нет «вечной загрузки» и старого HTML при живой сети);
   • /assets/* (файлы сборки с хэшем в имени): кэш первым — они неизменяемы;
   • картинки (/menu, /reference, /icons, Supabase Storage): кэш первым, обновление фоном;
   • API (Supabase, OpenRouter, Vercel /api): только сеть — данные приложение кэширует само (localStorage).
   Версию менять при смене стратегии; файлы сборки версии не требуют — у них хэш в имени. */
const VERSION = "sa-sw-v1";
const SHELL = VERSION + "-shell";
const ASSETS = VERSION + "-assets";
const IMAGES = VERSION + "-images";
const IMG_LIMIT = 300;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    try { await c.add(new Request("/", { cache: "reload" })); } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, ASSETS, IMAGES]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isApi = (u) => /supabase\.co|openrouter\.ai|\/api\//.test(u.href) || u.pathname.startsWith("/api/");
const isAsset = (u) => u.origin === self.location.origin && u.pathname.startsWith("/assets/");
const isImage = (u) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(u.pathname) || /\/storage\/v1\/object\/public\//.test(u.href);

async function trim(cacheName, limit) {
  const c = await caches.open(cacheName); const keys = await c.keys();
  if (keys.length > limit) for (const k of keys.slice(0, keys.length - limit)) await c.delete(k);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (isApi(u)) return; // данные — только сеть

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(SHELL); c.put("/", fresh.clone());
        return fresh;
      } catch (err) {
        const c = await caches.open(SHELL);
        return (await c.match("/")) || (await c.match(req)) || new Response("<!doctype html><meta charset=utf-8><body style='background:#171208;color:#C8A96E;font-family:Georgia,serif;text-align:center;padding:40vh 24px 0'>✦ SA<br><br>Нет сети и нет сохранённой копии.<br>Открой приложение один раз при связи.</body>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  if (isAsset(u)) {
    e.respondWith((async () => {
      const c = await caches.open(ASSETS);
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    })());
    return;
  }

  if (isImage(u)) {
    e.respondWith((async () => {
      const c = await caches.open(IMAGES);
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") { c.put(req, res.clone()); trim(IMAGES, IMG_LIMIT); } return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }
  // шрифты и прочее с CDN — сеть, при отказе кэш (если был)
  if (u.origin !== self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(ASSETS);
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
      catch (err) { return (await c.match(req)) || Response.error(); }
    })());
  }
});
