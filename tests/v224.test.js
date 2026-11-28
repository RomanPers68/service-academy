// v224 (Доп. 550): бесшовная загрузка. Владелец (28.11): «Когда заходишь в приложение по закреплённой ссылке на главном
// экране (на iPhone), то многие фото, да и всё остальное (кроме справочника и приветственных видео) грузит очень долго,
// а должно быть бесшовно». И три правки вида из разбора: служебная строка в «Меню», подпись шага, номера тем.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { sbTimed, makeSbFetch, SB_WAIT } from "../lib/supabase.js";
import { aheadPool, AHEAD_PAR } from "../lib/lesson-photo.js";
import { menuPhotoUrls, aheadTodo, photosAhead, AHEAD_AGAIN, AHEAD_MAX, AHEAD_DELAY } from "../lib/photo-ahead.js";
import { aheadStaffThumbs, SP_AHEAD_MS } from "../lib/staff-photo.js";

const rd = (f) => readFileSync(f, "utf8");
const SB = "https://gvxhgdynjuaisswplroh.supabase.co";
const HOST = "service-academy-16te.vercel.app", SITE = "https://" + HOST;
const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };

describe("v224 · версия и журнал", () => {
  it("сборка v224, Дополнение 550 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(224);
    const c = rd("CHANGES.md"), part = c.slice(c.indexOf("# Дополнение 550"));
    expect(part).toMatch(/^# Дополнение 550 — .*\(v224\)/);
    for (const w of ["по закреплённой ссылке", "бесшовно", "public/sw.js", "main.jsx", "lib/supabase.js", "lib/photo-ahead.js", "lib/staff-photo.js", "Цюрих"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v224 · новая сборка не стирает фото и файлы (main.jsx)", () => {
  it("стирается только сохранённая копия страницы (…-shell)", () => {
    const m = rd("main.jsx");
    expect(m).toContain("keys.filter(k => /-shell$/.test(k)).map(k => caches.delete(k))");
    expect(m).not.toContain("keys.map(k => caches.delete(k))");
  });
});

// ── сервис-воркер в песочнице: свои таймеры и свой кэш ───────────────────────────────────────────────────────────────
const loadSW = (o = {}) => {
  const H = {}, fetched = [], stores = new Map(), timers = [];
  const keyOf = (r) => (typeof r === "string" ? new URL(r, SITE).href : r.url);
  const cacheOf = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return { match: async (r) => m.get(keyOf(r)), put: async (r, v) => { m.delete(keyOf(r)); m.set(keyOf(r), v); },
      keys: async () => [...m.keys()].map((u) => ({ url: u })), delete: async (k) => m.delete(keyOf(k)) };
  };
  const self = { addEventListener: (k, f) => { H[k] = f; }, location: { origin: SITE, hostname: HOST }, skipWaiting: () => {}, registration: {}, navigator: {}, clients: {} };
  const fetch = (req) => { const u = typeof req === "string" ? req : req.url; fetched.push(u); return o.net ? o.net(u) : Promise.resolve(new Response("ok", { status: 200 })); };
  vm.runInNewContext(rd("public/sw.js"), { self, caches: { open: async (n) => cacheOf(n), keys: async () => [...stores.keys()] }, fetch, URL, Response, Request, console, Promise,
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => {}, Math, JSON, String, Number, Array, Set });
  const go = (request) => { let p = null; const wait = []; H.fetch({ request, respondWith: (x) => { p = x; }, waitUntil: (x) => wait.push(x) }); return { p, wait }; };
  return { fetched, stores, timers, cacheOf, go };
};
const NAV = { method: "GET", url: SITE + "/", mode: "navigate" };
const SHELL = "sa-sw-v1-shell", ASSETS = "sa-sw-v1-assets", IMAGES = "sa-sw-v1-images";

describe("v224 · страница с ярлыка (public/sw.js)", () => {
  it("сеть молчит дольше 2,5 с — сохранённая копия; свежая, когда придёт, ложится фоном", async () => {
    let answer = null;
    const s = loadSW({ net: () => new Promise((r) => { answer = r; }) });
    await s.cacheOf(SHELL).put("/", new Response("старая", { status: 200 }));
    const { p, wait } = s.go(NAV);
    await settle();
    const t = s.timers.find((x) => x.ms === 2500);
    expect(t).toBeTruthy();
    t.f();
    expect(await (await p).text()).toBe("старая");
    answer(new Response("новая", { status: 200 }));
    await Promise.all(wait);
    expect(await (await s.cacheOf(SHELL).match("/")).text()).toBe("новая");
  });
  it("сеть успела — свежая страница, она же в копию", async () => {
    const s = loadSW({ net: () => Promise.resolve(new Response("свежая", { status: 200 })) });
    await s.cacheOf(SHELL).put("/", new Response("старая", { status: 200 }));
    const { p, wait } = s.go(NAV);
    expect(await (await p).text()).toBe("свежая");
    await Promise.all(wait);
    expect(await (await s.cacheOf(SHELL).match("/")).text()).toBe("свежая");
  });
  it("сеть ответила ошибкой или её нет — сохранённая копия; ошибку в копию не кладём", async () => {
    for (const net of [() => Promise.resolve(new Response("сбой", { status: 502 })), () => Promise.reject(new TypeError("offline"))]) {
      const s = loadSW({ net });
      const old = new Response("старая", { status: 200 });
      await s.cacheOf(SHELL).put("/", old);
      const { p, wait } = s.go(NAV);
      const r = await p;
      expect(r).toBe(old);
      await Promise.all(wait);
      expect(await s.cacheOf(SHELL).match("/")).toBe(old);   // копия прежняя: ошибку сервера в неё не положили
    }
  });
  it("копии нет — ждём сеть, как раньше; нет и сети — страница «Нет сети»", async () => {
    const s = loadSW({ net: () => new Promise((r) => setImmediate(() => r(new Response("свежая", { status: 200 })))) });
    expect(await (await s.go(NAV).p).text()).toBe("свежая");
    expect(s.timers.some((x) => x.ms === 2500)).toBe(false);
    const d = loadSW({ net: () => Promise.reject(new TypeError("offline")) });
    expect(await (await d.go(NAV).p).text()).toMatch(/Нет сети/);
  });
});

describe("v224 · файлы сборки и фото (public/sw.js)", () => {
  it("файлы сборки копятся до 400, дальше уходят самые старые", async () => {
    const s = loadSW();
    for (let i = 0; i < 405; i++) { await s.go(new Request(SITE + "/assets/c" + i + "-x.js")).p; await settle(3); }
    await settle(20);
    const keys = [...s.stores.get(ASSETS).keys()];
    expect(keys.length).toBe(400);
    expect(keys[0]).toBe(SITE + "/assets/c5-x.js");
    expect(keys[399]).toBe(SITE + "/assets/c404-x.js");
  });
  it("фото из хранилища, раз скачанное, — из памяти и без сети; картинки сайта — из памяти, свежая фоном", async () => {
    const IMG = SITE + "/sb/storage/v1/object/public/menu-photos/r/d-1.jpg";
    const s = loadSW();
    await s.cacheOf(IMAGES).put(IMG, new Response("фото", { status: 200 }));
    expect(await (await s.go(new Request(IMG)).p).text()).toBe("фото");
    expect(s.fetched).toEqual([]);
    const own = SITE + "/menu/borsch.jpg";
    await s.cacheOf(IMAGES).put(own, new Response("старое", { status: 200 }));
    expect(await (await s.go(new Request(own)).p).text()).toBe("старое");
    expect(s.fetched).toEqual([own]);
  });
  it("в шапке воркера — что поменялось в v224", () => {
    const w = rd("public/sw.js");
    expect(w).toContain("const ASSET_LIMIT = 400;");
    expect(w).toContain("const NAV_WAIT = 2500;");
    expect(w).toContain("const fixed = (u) => /\\/storage\\/v1\\/object\\/public\\//.test(u.href);");
  });
});

describe("v224 · запрос к базе не ждёт вечно (lib/supabase.js)", () => {
  it("ни байта дольше срока — ошибка TimeoutError; ответ замер посреди тела — тоже", async () => {
    await expect(sbTimed(() => new Promise(() => {}), "x", {}, 40)).rejects.toMatchObject({ name: "TimeoutError" });
    const stall = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{")); } });
    await expect(sbTimed(async () => new Response(stall, { status: 200 }), "x", {}, 40)).rejects.toMatchObject({ name: "TimeoutError" });
  });
  it("медленный, но живой ответ доходит целиком: каждый кусок взводит сторожа заново", async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream({ start(c) { let i = 0; const go = () => { if (i < 4) { c.enqueue(enc.encode(String(i++))); setTimeout(go, 25); } else c.close(); }; go(); } });
    const r = await sbTimed(async () => new Response(body, { status: 200, headers: { "x-k": "1" } }), "x", {}, 40);
    expect([r.status, r.headers.get("x-k"), await r.text()]).toEqual([200, "1", "0123"]);
    const e = await sbTimed(async () => new Response(null, { status: 204 }), "x", {}, 40);
    expect(e.status).toBe(204);
  });
  it("свой сигнал отмены доходит до запроса; срок по умолчанию — 20 секунд", async () => {
    const ac = new AbortController();
    let seen = null;
    const p = sbTimed((u, init) => { seen = init.signal; return new Promise((_, bad) => init.signal.addEventListener("abort", () => bad(new Error("abort")))); }, "x", { signal: ac.signal }, 1000);
    ac.abort();
    await expect(p).rejects.toThrow("abort");
    expect(seen.aborted).toBe(true);
    expect(SB_WAIT).toBe(20000);
  });
  it("через сайт завис — тот же запрос напрямую; оба зависли — ошибка срока", async () => {
    const calls = [];
    const f = (u) => { calls.push(u); return u.startsWith(SITE) ? new Promise(() => {}) : Promise.resolve(new Response("{}", { status: 200 })); };
    const sb = makeSbFetch({ base: SITE + "/sb", direct: SB, fetchFn: f, wait: 30 });
    expect((await sb("/rest/v1/rpc/a", {})).status).toBe(200);
    expect(calls).toEqual([SITE + "/sb/rest/v1/rpc/a", SB + "/rest/v1/rpc/a"]);
    const both = makeSbFetch({ base: SITE + "/sb", direct: SB, fetchFn: () => new Promise(() => {}), wait: 30 });
    await expect(both("/rest/v1/rpc/a", {})).rejects.toMatchObject({ name: "TimeoutError" });
  });
});

describe("v224 · фото заранее", () => {
  it("фото уроков и разделов — по три сразу, по порядку списка (lib/lesson-photo.js)", async () => {
    let live = 0, peak = 0;
    const order = [];
    await aheadPool([1, 2, 3, 4, 5, 6, 7], async (id) => { order.push(id); live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live--; });
    expect([AHEAD_PAR, peak, order]).toEqual([3, 3, [1, 2, 3, 4, 5, 6, 7]]);
    const l = rd("lib/lesson-photo.js");
    for (const s of ["await aheadPool(head, thumb);", "await aheadPool(head, whole);", "await aheadPool(thumbs, thumb);", "await aheadPool(full.slice(HOT_MAX), whole);"]) expect(l, s).toContain(s);
  });
  it("кружки всей команды — заранее, как пришёл список; бережная сеть и нет списка — ничего (lib/staff-photo.js)", async () => {
    expect(await aheadStaffThumbs({ items: [{ id: "a", ver: "1" }] }, { lean: true })).toBe(0);
    expect(await aheadStaffThumbs("missing")).toBe(0);
    expect(await aheadStaffThumbs(null)).toBe(0);
    expect(SP_AHEAD_MS).toBe(2500);
    const s = rd("lib/staff-photo.js");
    expect(s).toContain("writeCache(n); emit(); pruneStaffPhotos(n); planStaffAhead(n);");
    expect(s).toContain("aheadStaffThumbs(list, { lean: leanNet() })");
  });
  it("фото меню: только файлы хранилища, без повторов, своё меню первым (lib/photo-ahead.js)", () => {
    const P = SB + "/storage/v1/object/public/menu-photos/r/";
    const shared = { "Океан": [{ img: P + "a.jpg" }, { img: P + "b.jpg" }, { img: "/menu/x.jpg" }, { img: "data:image/png;base64,AA" }, { img: P + "a.jpg" }, null, { img: 5 }], "Другое": [{ img: P + "z.jpg" }] };
    const custom = { "Океан": [{ img: P + "c.jpg" }, { img: "http://x/storage/v1/object/public/q.jpg" }] };
    expect(menuPhotoUrls(shared, custom, "Океан")).toEqual([P + "c.jpg", P + "a.jpg", P + "b.jpg"]);
    expect(menuPhotoUrls(shared, custom, "Океан", 2)).toEqual([P + "c.jpg", P + "a.jpg"]);
    expect(menuPhotoUrls({}, null, "Океан")).toEqual([]);
    expect([AHEAD_MAX, AHEAD_DELAY, AHEAD_AGAIN]).toEqual([150, 7000, 7 * 24 * 3600 * 1000]);
  });
  it("взятое заранее за последнюю неделю — не берём", () => {
    const now = 10 * AHEAD_AGAIN;
    expect(aheadTodo(["a", "b", "c"], { a: now - 1000, b: now - AHEAD_AGAIN - 1 }, now)).toEqual(["b", "c"]);
  });
  it("качаем по три сразу; отметка — только у скачанного", async () => {
    let live = 0, peak = 0;
    const done = {}, saves = [];
    const f = async (u) => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live--; if (u === "bad") throw new TypeError("net"); return { ok: u !== "404", arrayBuffer: async () => new ArrayBuffer(1) }; };
    const got = await photosAhead(["1", "2", "bad", "404", "5", "6"], { fetchFn: f, done, save: (d) => saves.push(Object.keys(d).length), now: () => 7 });
    expect([got, peak, Object.keys(done).sort(), saves.length]).toEqual([4, 3, ["1", "2", "5", "6"], 4]);
    let n = 0;
    await photosAhead(["1", "2", "3"], { fetchFn: async () => { n++; return { ok: true }; }, alive: () => n < 1 });
    expect(n).toBe(1);   // экран скрыли — дальше не качаем
  });
  it("запуск с главной — через AHEAD_DELAY после входа (App.jsx)", () => {
    const a = rd("App.jsx");
    expect(a).toContain('import { menuPhotosAhead, AHEAD_DELAY } from "./lib/photo-ahead";');
    expect(a).toContain("const t = setTimeout(() => { menuPhotosAhead(aheadRest); }, AHEAD_DELAY);");
  });
});

describe("v224 · «Первая неделя» не мелькает (App.jsx)", () => {
  it("прошлый ответ newbie_me — с телефона сразу, свежий — туда же", () => {
    const a = rd("App.jsx");
    expect(a).toContain('const nbKey = ukP ? "sa_nb_me" + ukP : "";');
    expect(a).toContain("setNbInfo((v) => v || (c.off ? { off: true } : newbieModel(c)))");
    expect(a).toContain("if (r && r.ok) { setNbInfo(newbieModel(r)); try { if (nbKey) localStorage.setItem(nbKey, JSON.stringify(r)); } catch (e) {} }");
  });
});

describe("v224 · вид", () => {
  it("«Меню»: служебная строка и пищевая ценность — только тем, кто правит меню", () => {
    const m = rd("ui/menu-trainer.jsx");
    expect(m).toContain('{canEdit ? <span data-menu-service="">Блюд в базе: ');
    expect(m).toContain("{canEdit && dishes.length > 0 && (() => {");
    expect(m).not.toMatch(/\n\s+Блюд в базе: <b/);
  });
  it("подпись текущего шага — частями: не влезла — вторая часть строкой ниже, посреди слова не режется", () => {
    expect(rd("ui/module-menu.jsx")).toContain('<span className="tbm-ckt">');
    expect(rd("ui/table-css.js")).toContain(".tbm-ck{flex-wrap:wrap;row-gap:2px}.tbm-ckt{min-width:0;white-space:normal}.tbm-ckt>span{white-space:nowrap}");
  });
  it("номера тем: помещаются — подпись темы сразу под пальцем; палец вверх-вниз — это прокрутка", () => {
    const s = rd("ui/screens-learning.jsx");
    expect(s).toContain("const fits = !(row && row.scrollWidth > row.clientWidth + 1);");
    expect(s).toContain("if (fits) setPeek({ i, pinned: pin });");
    expect(s).toContain("if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(peekT.current); peekG.current = null; setPeek(null); return; }");
  });
});
