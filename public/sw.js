/* Service Academy — сервис-воркер (Дополнение 173): приложение открывается без сети.
   Стратегия:
   • навигация (index.html): сеть первой, при отказе — сохранённая копия (нет «вечной загрузки» и старого HTML при живой сети);
   • /assets/* (файлы сборки с хэшем в имени): кэш первым — они неизменяемы;
   • картинки (/menu, /reference, /icons, Supabase Storage): кэш первым, обновление фоном;
   • API (Supabase, OpenRouter, Vercel /api): только сеть — данные приложение кэширует само (localStorage).
   Версию менять при смене стратегии; файлы сборки версии не требуют — у них хэш в имени.
   v137: ещё уведомления на телефон (push, notificationclick) — внизу файла. */
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

// Доп. 279: страница просит новый воркер не ждать — тогда обновление приезжает сразу
self.addEventListener("message", (e) => { if (e.data === "skip-waiting") self.skipWaiting(); });

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

/* v137 (Доп. 450, 451): уведомления на телефон (этап 48, функция push-send): { t — заголовок, b — текст, go — экран,
   badge — число на иконке, c — переписка, a — кнопки, k — их ключ, u — куда их нажимать }. Пришедшее показываем всегда:
   iPhone выключает подписку, если уведомление не показать (не вышло с кнопками — показываем просто текст).
   Доп. 451: одна переписка — одно уведомление (тег chat-<c>: Android заменяет сам; на iPhone тег не работает — прежние
   уведомления той же переписки закрываем сами). В строке состояния Android — одноцветный бокал (badge). Кнопки (Android):
   «Ответить» — поле прямо в уведомлении, «Прочитано», «Принято», «Забрать», «Иду»; нажатие — функция push-send (?act=1),
   ответ («Ушло в «…».») — коротким уведомлением. Касание или кнопка не сработала — нужный экран: приложение открыто —
   переходит само (сообщение sa-go), закрыто — открываем /?go=… («Ответить» без текста — переписка с готовым ответом). */
const GO_OK = /^[A-Za-z0-9_.:-]{1,90}$/;
const ACT_OK = /^(reply|read|cl|ct|cg)$/;
const ICON = "/icons/icon-192.png", BADGE = "/icons/badge-96.png";
function setBadge(n) {
  const nav = self.navigator;
  if (!Number.isInteger(n) || n < 0 || !nav || typeof nav.setAppBadge !== "function") return null;
  return (n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => {});
}
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { try { d = { b: e.data ? e.data.text() : "" }; } catch (x) { d = {}; } }
  if (!d || typeof d !== "object") d = {};
  const go = typeof d.go === "string" && GO_OK.test(d.go) ? d.go : "";
  const c = Number.isInteger(d.c) && d.c > 0 ? d.c : null;
  const k = typeof d.k === "string" && /^[0-9a-f]{64}$/.test(d.k) ? d.k : "";
  const u = typeof d.u === "string" && /^https:\/\/[^\s"<>]{8,200}$/.test(d.u) ? d.u : "";
  const acts = k && u && Array.isArray(d.a) ? d.a.filter((x) => x && ACT_OK.test(String(x.a)) && String(x.t || "").trim()).slice(0, 2) : [];
  const id = Math.random().toString(36).slice(2);
  const title = String(d.t || "Service Academy").slice(0, 120), body = String(d.b || "").slice(0, 300);
  const o = { body, icon: ICON, badge: BADGE, lang: "ru", data: { go, c, k: acts.length ? k : "", u: acts.length ? u : "", id } };
  if (c) { o.tag = "chat-" + c; o.renotify = true; }
  if (acts.length) {
    o.actions = acts.map((x) => (x.a === "reply" ? { action: "reply", title: String(x.t).trim().slice(0, 24), type: "text", placeholder: "Ответ…" }
      : { action: x.a, title: String(x.t).trim().slice(0, 24) }));
  }
  const reg = self.registration;
  const shown = reg.showNotification(title, o)
    .catch(() => reg.showNotification(title, { body, icon: ICON, lang: "ru", data: { go, c, id } }))
    // iPhone: тег не работает — прежние уведомления этой переписки закрываем (остаётся последнее)
    .then(() => (c && typeof reg.getNotifications === "function" ? reg.getNotifications() : []))
    .then((list) => { for (const n of list || []) if (n && n.data && n.data.c === c && n.data.id !== id) n.close(); })
    .catch(() => {});
  const jobs = [shown], b = setBadge(d.badge);
  if (b) jobs.push(b);
  e.waitUntil(Promise.all(jobs));
});
// открыть приложение на экране go: открыто — переходит само, закрыто — /?go=…
async function openGo(go) {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of list) {
    try { if (new URL(c.url).origin !== self.location.origin) continue; } catch (err) { continue; }
    try { c.postMessage({ type: "sa-go", go }); } catch (err) { /* окно закрывается */ }
    if (typeof c.focus === "function") { try { await c.focus(); } catch (err) { /* */ } }
    return;
  }
  if (self.clients.openWindow) await self.clients.openWindow("/" + (go ? "?go=" + encodeURIComponent(go) : ""));
}
// кнопка под уведомлением: в функцию push-send; → ответ { ok, text, badge } или null
async function pressAct(data, act, reply) {
  try {
    const r = await fetch(data.u, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(act === "reply" ? { k: data.k, a: act, r: reply } : { k: data.k, a: act }) });
    const j = await r.json();
    return j && typeof j === "object" ? j : null;
  } catch (err) { return null; }
}
self.addEventListener("notificationclick", (e) => {
  const n = e.notification, data = (n && n.data) || {};
  n.close();
  const go = typeof data.go === "string" && GO_OK.test(data.go) ? data.go : "";
  const act = typeof e.action === "string" && ACT_OK.test(e.action) ? e.action : "";
  e.waitUntil((async () => {
    const reply = act === "reply" ? String(e.reply || "").trim().slice(0, 1000) : "";
    if (act && data.k && data.u && (act !== "reply" || reply)) {
      const res = await pressAct(data, act, reply);
      if (res && res.ok) {
        setBadge(res.badge);
        if (res.text) {
          const reg = self.registration;
          await reg.showNotification(String(res.text).slice(0, 120), { body: "", icon: ICON, badge: BADGE, lang: "ru", tag: "sa-done", silent: true, data: { go: "" } }).catch(() => {});
          await new Promise((ok) => setTimeout(ok, 4000));
          if (typeof reg.getNotifications === "function") { try { for (const x of await reg.getNotifications({ tag: "sa-done" })) x.close(); } catch (err) { /* */ } }
        }
        return;
      }
    }
    await openGo(go);
  })());
});
