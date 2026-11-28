// v223 (Доп. 549): база — через свой сайт. В России провайдеры режут соединения с Supabase (он за Cloudflare), а сайт на
// Vercel открывается. vercel.json пересылает /sb/… в Supabase; на своём адресе (*.vercel.app) приложение ходит к базе
// через /sb (lib/supabase.js: sbBase, makeSbFetch с запасным путём напрямую), сервис-воркер переводит через сайт полные
// адреса Supabase (картинки и файлы из базы, кнопки под уведомлениями).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { sbBase, makeSbFetch, sbIn, sbOut, SUPABASE_URL, SUPABASE_DIRECT } from "../lib/supabase.js";

const rd = (f) => readFileSync(f, "utf8");
const SB = "https://gvxhgdynjuaisswplroh.supabase.co";
const HOST = "service-academy-16te.vercel.app", SITE = "https://" + HOST;

describe("v223 · версия и журнал", () => {
  it("сборка v223, Дополнение 549, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(223);
    const c = rd("CHANGES.md"), part = c.slice(c.indexOf("# Дополнение 549"));
    expect(part).toMatch(/^# Дополнение 549 — .*\(v223\)/);
    for (const w of ["/sb/", "vercel.json", "Cloudflare", "InterkamService", "lib/supabase.js", "public/sw.js"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v223 · правило на сайте (vercel.json)", () => {
  it("/sb/… → тот же путь в Supabase; заголовки сайта на месте", () => {
    const v = JSON.parse(rd("vercel.json"));
    expect(v.rewrites).toEqual([{ source: "/sb/:path*", destination: SB + "/:path*" }]);
    expect(v.headers.map((h) => h.source)).toEqual(["/.well-known/assetlinks.json", "/(.*)", "/sb/((?!storage/v1/object/public/).*)",
      "/sb/storage/v1/object/public/(.*)", "/assets/(.*)", "/menu/(.*)", "/reference/(.*)", "/video/(.*)", "/icons/(.*)"]);
  });
  it("ответы базы на сайте не кэшируются; фото из хранилища — на сутки, как /menu", () => {
    const v = JSON.parse(rd("vercel.json"));
    const of = (src) => v.headers.find((h) => h.source === src).headers;
    expect(of("/sb/((?!storage/v1/object/public/).*)")).toEqual([{ key: "x-vercel-enable-rewrite-caching", value: "0" }]);
    expect(of("/sb/storage/v1/object/public/(.*)")).toEqual([{ key: "Cache-Control", value: "public, max-age=86400" }]);
    const re = /^\/sb\/((?!storage\/v1\/object\/public\/).*)$/;   // то же правило, что у Vercel
    expect(["/sb/rest/v1/rpc/whoami", "/sb/functions/v1/ai-chat", "/sb/auth/v1/health", "/sb/storage/v1/object/sign/x"].every((x) => re.test(x))).toBe(true);
    expect(re.test("/sb/storage/v1/object/public/menu-photos/a.jpg")).toBe(false);
  });
});

describe("v223 · куда ходит приложение (lib/supabase.js)", () => {
  it("на своём адресе *.vercel.app — через сайт; локально, по http и с другим проектом — напрямую", () => {
    expect(sbBase(HOST, SITE)).toBe(SITE + "/sb");
    expect(sbBase("service-academy-16te-git-main-x.vercel.app", "https://service-academy-16te-git-main-x.vercel.app")).toBe("https://service-academy-16te-git-main-x.vercel.app/sb");
    expect(sbBase("localhost", "http://localhost:5321")).toBe(SB);
    expect(sbBase(HOST, "http://" + HOST)).toBe(SB);
    expect(sbBase(HOST, SITE, "https://other.supabase.co")).toBe("https://other.supabase.co");
    expect([sbBase(null, null), sbBase("", ""), sbBase("evil.vercel.app.example.com", "https://evil.vercel.app.example.com")]).toEqual([SB, SB, SB]);
    expect(SUPABASE_DIRECT).toBe(SB);
    expect(SUPABASE_URL).toBe(SB);   // в проверках адреса страницы нет — напрямую
  });
  const res = (status, h = {}) => ({ status, headers: { get: (k) => h[k.toLowerCase()] || null } });
  const fake = (plan) => { const calls = []; const f = async (u) => { calls.push(u); const x = plan(u, calls.length); if (x instanceof Error) throw x; return x; }; return { f, calls }; };
  it("сайт ответил — один запрос через сайт; ответ базы с ошибкой — как есть, без повтора", async () => {
    const { f, calls } = fake((u) => (u.endsWith("missing") ? res(404) : res(200)));
    const sb = makeSbFetch({ base: SITE + "/sb", direct: SB, fetchFn: f });
    expect((await sb("/rest/v1/rpc/whoami", {})).status).toBe(200);
    expect((await sb("/rest/v1/rpc/missing", {})).status).toBe(404);
    expect(calls).toEqual([SITE + "/sb/rest/v1/rpc/whoami", SITE + "/sb/rest/v1/rpc/missing"]);
  });
  it("нет связи до сайта — тот же запрос напрямую, а следующий снова через сайт; напрямую тоже нет — прежняя ошибка", async () => {
    const down = new TypeError("Failed to fetch");
    const { f, calls } = fake((u, i) => (u.startsWith(SITE) && i === 1 ? down : res(200)));
    const sb = makeSbFetch({ base: SITE + "/sb", direct: SB, fetchFn: f });
    expect((await sb("/rest/v1/rpc/a", {})).status).toBe(200);
    await sb("/rest/v1/rpc/b", {});
    expect(calls).toEqual([SITE + "/sb/rest/v1/rpc/a", SB + "/rest/v1/rpc/a", SITE + "/sb/rest/v1/rpc/b"]);
    expect(sb.base()).toBe(SITE + "/sb");
    const both = fake(() => down);
    const sb2 = makeSbFetch({ base: SITE + "/sb", direct: SB, fetchFn: both.f });
    await expect(sb2("/rest/v1/rpc/a", {})).rejects.toBe(down);
    expect(both.calls.length).toBe(2);
  });
  it("Vercel отказал сам (x-vercel-mitigated, x-vercel-error) — напрямую; вышло — дальше до перезапуска напрямую", async () => {
    const { f, calls } = fake((u) => (u.startsWith(SITE) ? res(403, { "x-vercel-mitigated": "deny" }) : res(200)));
    const sb = makeSbFetch({ base: SITE + "/sb", direct: SB, fetchFn: f });
    expect((await sb("/rest/v1/rpc/a", {})).status).toBe(200);
    expect(sb.base()).toBe(SB);
    await sb("/rest/v1/rpc/b", {});
    expect(calls).toEqual([SITE + "/sb/rest/v1/rpc/a", SB + "/rest/v1/rpc/a", SB + "/rest/v1/rpc/b"]);
    const no = fake((u) => (u.startsWith(SITE) ? res(502, { "x-vercel-error": "ROUTER_EXTERNAL_TARGET_ERROR" }) : new TypeError("down")));
    const sb2 = makeSbFetch({ base: SITE + "/sb", direct: SB, fetchFn: no.f });
    expect((await sb2("/rest/v1/rpc/a", {})).status).toBe(502);   // напрямую не вышло — ответ сайта как есть
    expect(sb2.base()).toBe(SITE + "/sb");
  });
  it("адрес и есть Supabase — без запасного пути", async () => {
    const { f, calls } = fake(() => res(200));
    const sb = makeSbFetch({ base: SB, direct: SB, fetchFn: f });
    await sb("/rest/v1/rpc/a", {});
    expect(calls).toEqual([SB + "/rest/v1/rpc/a"]);
  });
  it("ссылки хранилища: в ответах базы — через сайт, в запросах к базе — обратно; без сайта — как есть", () => {
    const P = "/storage/v1/object/public/", A = SB + P + "menu-photos/r/d-1.jpg", S = SITE + "/sb" + P + "menu-photos/r/d-1.jpg";
    const got = sbIn({ ok: true, dishes: [{ img: A, name: "Борщ" }, { img: "/menu/x.jpg" }], note: "фото: " + A, n: 3, z: null }, SITE + "/sb", SB);
    expect(got).toEqual({ ok: true, dishes: [{ img: S, name: "Борщ" }, { img: "/menu/x.jpg" }], note: "фото: " + S, n: 3, z: null });
    expect(sbIn(A, SITE + "/sb", SB)).toBe(S);
    expect(sbIn([A, 1, true], SB, SB)).toEqual([A, 1, true]);            // запасной путь напрямую — ссылки не трогаем
    expect(sbIn(SB + "/rest/v1/x", SITE + "/sb", SB)).toBe(SB + "/rest/v1/x");   // только хранилище
    expect(sbOut(JSON.stringify({ img: S, other: A }), SITE + "/sb", SB)).toBe(JSON.stringify({ img: A, other: A }));
    expect(sbOut('{"img":"' + S + '"}', SB, SB)).toBe('{"img":"' + S + '"}');
    expect(sbIn({ img: A })).toEqual({ img: A });   // в проверках адреса страницы нет — без изменений
    expect(sbOut('{"img":"' + A + '"}')).toBe('{"img":"' + A + '"}');
  });
  it("ссылки хранилища меняются в одном месте: чтение и запись базы, ответы загрузки фото и голоса", () => {
    const s = rd("lib/supabase.js");
    expect(s).toContain("body: sbOut(JSON.stringify(params || {}))\n}).then(r => r.json()).then((j) => sbIn(j));");
    expect(s).toContain("body: sbOut(JSON.stringify(item.params || {}))");
    expect(s).toContain(".then(data => ({ data: sbIn(data), error: null }))");
    expect(s).toContain("body: sbOut(JSON.stringify(row))");
    expect(rd("lib/voice-note.js")).toContain("return { ok: true, url: sbIn(j.url) };");
    expect(rd("lib/radio-voice.js")).toContain("if (j && j.ok && j.url) return sbIn(j.url);");
    expect(rd("ui/wine-editor.jsx")).toContain("if (j && j.ok && j.url) return sbIn(j.url);");
    expect(rd("ui/cocktail-editor.jsx")).toContain("setForm(f => ({ ...f, img: sbIn(j.url) }))");
    expect(rd("ui/menu-trainer.jsx").match(/img: sbIn\(j\.url\)/g).length).toBe(3);
    for (const f of ["lib/voice-note.js", "lib/radio-voice.js", "ui/wine-editor.jsx", "ui/cocktail-editor.jsx", "ui/menu-trainer.jsx"]) {
      expect(rd(f), f).not.toMatch(/img: j\.url|url: j\.url \}|return j\.url;/);
    }
  });
  it("запросы к базе — через sbFetch; серверу — настоящий адрес Supabase", () => {
    const s = rd("lib/supabase.js");
    expect(s).toContain("const _rawRpc = (fn, params) => sbFetch(`/rest/v1/rpc/${fn}`, {");
    expect(s).toContain("  sbFetch(`/rest/v1/rpc/${item.fn}`, {");
    expect(s).toContain("select: (cols) => sbFetch(`/rest/v1/${table}?select=${cols||\"*\"}`, {");
    expect(s).toContain("insert: (row) => sbFetch(`/rest/v1/${table}`, {");
    expect(s).not.toMatch(/fetch\(`\$\{SUPABASE_URL\}\/rest\/v1/);
    expect(rd("lib/push.js")).toContain("p_url: admin ? SUPABASE_DIRECT : null");
    expect(rd("ui/server.jsx")).toContain("p_buckets: stageBuckets(), p_url: SUPABASE_DIRECT }");
  });
});

describe("v223 · сервис-воркер: полные адреса Supabase — через сайт", () => {
  const load = (host, o = {}) => {
    const H = {}, fetched = [], store = new Map();
    const key = (r) => (typeof r === "string" ? r : r.url);
    const cache = { match: async (r) => store.get(key(r)), put: async (r, v) => { store.set(key(r), v); }, keys: async () => [...store.keys()], delete: async (k) => store.delete(key(k)) };
    const self = { addEventListener: (k, f) => { H[k] = f; }, location: { origin: "https://" + host, hostname: host }, skipWaiting: () => {},
      registration: { showNotification: async () => {}, getNotifications: async () => [] }, navigator: {}, clients: { matchAll: async () => [], openWindow: async () => {} } };
    const fetch = async (url, init) => {
      const u = key(url);
      fetched.push({ url: u, method: (init && init.method) || (typeof url === "string" ? "GET" : url.method), body: init && init.body !== undefined ? Buffer.from(init.body).toString() : null });
      if (o.down && o.down(u)) throw new TypeError("network");
      return new Response(o.json ? JSON.stringify(o.json) : "ok", { status: 200 });
    };
    vm.runInNewContext(rd("public/sw.js"), { self, caches: { open: async () => cache, keys: async () => [] }, fetch, URL, Response, Request, console, Promise, setTimeout: (f) => f(), Math, JSON, String, Number, Array, Set });
    const go = async (request) => { let p = null; H.fetch({ request, respondWith: (x) => { p = x; }, waitUntil: () => {} }); return p ? p : undefined; };
    const click = async (ev) => { let p = null; H.notificationclick({ ...ev, waitUntil: (x) => { p = x; } }); await p; };
    return { fetched, store, go, click };
  };
  const IMG = SB + "/storage/v1/object/public/menu/borsch.jpg";
  it("картинка из базы: по сети — через сайт, в память телефона — под своим адресом; второй раз — из памяти", async () => {
    const s = load(HOST);
    const r = await s.go(new Request(IMG));
    expect(r.status).toBe(200);
    expect(s.fetched.map((x) => x.url)).toEqual([SITE + "/sb/storage/v1/object/public/menu/borsch.jpg"]);
    expect([...s.store.keys()]).toEqual([IMG]);
    await s.go(new Request(IMG));
    expect(s.fetched.length).toBe(1);   // v224: из памяти и без повторного скачивания — у файла хранилища адрес не меняется
  });
  it("запись в базу по полному адресу (POST) — через сайт с тем же телом; сайт не ответил — напрямую", async () => {
    const s = load(HOST);
    await s.go(new Request(SB + "/functions/v1/push-send?act=1", { method: "POST", body: '{"k":"x"}', headers: { "Content-Type": "application/json" } }));
    expect(s.fetched[0]).toEqual({ url: SITE + "/sb/functions/v1/push-send?act=1", method: "POST", body: '{"k":"x"}' });
    const d = load(HOST, { down: (u) => u.startsWith(SITE) });
    const r = await d.go(new Request(SB + "/rest/v1/rpc/whoami", { method: "POST", body: "{}" }));
    expect(r.status).toBe(200);
    expect(d.fetched.map((x) => x.url)).toEqual([SITE + "/sb/rest/v1/rpc/whoami", SB + "/rest/v1/rpc/whoami"]);
  });
  it("Vercel отказал сам (x-vercel-error) — картинка и запись напрямую", async () => {
    const H = {}, fetched = [], store = new Map();
    const key = (r) => (typeof r === "string" ? r : r.url);
    const cache = { match: async (r) => store.get(key(r)), put: async (r, v) => { store.set(key(r), v); }, keys: async () => [...store.keys()], delete: async (k) => store.delete(key(k)) };
    const self = { addEventListener: (k, f) => { H[k] = f; }, location: { origin: SITE, hostname: HOST }, skipWaiting: () => {}, registration: {}, navigator: {}, clients: {} };
    const fetch = async (url) => { const u = key(url); fetched.push(u);
      return u.startsWith(SITE) ? new Response("NOT_FOUND", { status: 404, headers: { "x-vercel-error": "NOT_FOUND" } }) : new Response("ok", { status: 200 }); };
    vm.runInNewContext(rd("public/sw.js"), { self, caches: { open: async () => cache, keys: async () => [] }, fetch, URL, Response, Request, console, Promise, setTimeout: (f) => f(), Math, JSON, String, Number, Array, Set });
    const go = async (request) => { let p = null; H.fetch({ request, respondWith: (x) => { p = x; } }); return p; };
    expect((await go(new Request(IMG))).status).toBe(200);
    expect((await go(new Request(SB + "/rest/v1/rpc/whoami", { method: "POST", body: "{}" }))).status).toBe(200);
    expect(fetched).toEqual([SITE + "/sb/storage/v1/object/public/menu/borsch.jpg", IMG, SITE + "/sb/rest/v1/rpc/whoami", SB + "/rest/v1/rpc/whoami"]);
  });
  it("не на своём адресе (localhost, чужой сайт) — воркер Supabase не трогает, как раньше", async () => {
    for (const h of ["localhost", "app.example"]) {
      const s = load(h);
      expect(await s.go(new Request(IMG)), h).toBe(undefined);
      expect(await s.go(new Request(SB + "/rest/v1/rpc/whoami", { method: "POST", body: "{}" })), h).toBe(undefined);
      expect(s.fetched, h).toEqual([]);
    }
  });
  it("/sb и /api — только сеть: переход по ссылке туда не ложится в память как приложение; картинка /sb — как картинка", async () => {
    const s = load(HOST);
    expect(await s.go({ method: "GET", url: SITE + "/sb/functions/v1/tg-bot?setup=abc", mode: "navigate" })).toBe(undefined);
    expect(await s.go({ method: "GET", url: SITE + "/api/cal?t=1", mode: "navigate" })).toBe(undefined);
    expect(await s.go({ method: "GET", url: SITE + "/sb/rest/v1/progress?select=*", mode: "cors" })).toBe(undefined);
    expect(s.store.size).toBe(0);
    const img = await s.go(new Request(SITE + "/sb/storage/v1/object/public/staff/a.webp"));
    expect(img.status).toBe(200);
    expect([...s.store.keys()]).toEqual([SITE + "/sb/storage/v1/object/public/staff/a.webp"]);
    const home = await s.go({ method: "GET", url: SITE + "/?go=morning", mode: "navigate" });
    expect(home.status).toBe(200);   // само приложение — как раньше: сеть первой, копия в память
  });
  it("кнопка под уведомлением: функция — через сайт; сайт не ответил — напрямую; чужой адрес — как есть", async () => {
    const K = "e".repeat(64), U = SB + "/functions/v1/push-send?act=1";
    const note = { data: { go: "chat_1_5", c: 1, k: K, u: U }, close: () => {} };
    const s = load(HOST, { json: { ok: true, text: null, badge: 0 } });
    await s.click({ notification: note, action: "read" });
    expect(s.fetched).toEqual([{ url: SITE + "/sb/functions/v1/push-send?act=1", method: "POST", body: JSON.stringify({ k: K, a: "read" }) }]);
    const d = load(HOST, { json: { ok: true, text: null, badge: 0 }, down: (u) => u.startsWith(SITE) });
    await d.click({ notification: note, action: "read" });
    expect(d.fetched.map((x) => x.url)).toEqual([SITE + "/sb/functions/v1/push-send?act=1", U]);
    const other = load(HOST, { json: { ok: true, text: null, badge: 0 } });
    await other.click({ notification: { ...note, data: { ...note.data, u: "https://gvx.supabase.co/functions/v1/push-send?act=1" } }, action: "read" });
    expect(other.fetched.map((x) => x.url)).toEqual(["https://gvx.supabase.co/functions/v1/push-send?act=1"]);
  });
});
