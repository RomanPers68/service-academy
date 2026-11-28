// v226 (Доп. 552): видео-знакомство не стоит на круге ожидания. Владелец (29.11, запись с ярлыка на iPhone): «Теперь
// видео очень долго грузит 🥺 Это сохраненная ссылка 😉». Сторож в плеере (ui/intro-video.jsx): ролик из памяти телефона
// не пошёл — из сети, и телефону это запоминаем (lib/intro-warm.js); из сети «залипло» — тот же ролик новым адресом.
// Пока идёт ролик, фото «заранее» ждут (lib/net-quiet.js). В браузере: tools/claude/e2e-v226.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { holdNet, netFree, netBusy, resetNetQuiet } from "../lib/net-quiet.js";
import { photosAhead } from "../lib/photo-ahead.js";
import { aheadPool } from "../lib/lesson-photo.js";
import { warmIntro, introSrc, introWarmState, resetIntroWarm, blobBad, markBlobBad, BLOB_BAD, BLOB_WAIT } from "../lib/intro-warm.js";
import { INTRO_VIDEOS } from "../data/intro-videos.js";
import { NET_STUCK, NET_RETRY, SLOW_HINT, WATCH_MS, freshSrc } from "../ui/intro-video.jsx";

const rd = (f) => readFileSync(f, "utf8");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const settle = async (n = 6) => { for (let k = 0; k < n; k++) await tick(5); };
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; };

describe("v226 · версия и журнал", () => {
  it("сборка v226, Дополнение 552 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(226);
    const c = rd("CHANGES.md"), part = c.slice(c.indexOf("# Дополнение 552"));
    expect(part).toMatch(/^# Дополнение 552 — .*\(v226\)/);
    for (const w of ["Теперь видео очень долго грузит", "Это сохраненная ссылка", "lib/net-quiet.js", "sa_intro_blob_bad", "e2e-v226.mjs"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v226.mjs");
  });
});

describe("v226 · связь — ролику (lib/net-quiet.js)", () => {
  beforeEach(() => resetNetQuiet());
  it("занял — занято; отпустил оба — свободно; повторное «отпустить» ничего не ломает", async () => {
    expect(netBusy()).toBe(false);
    const a = holdNet(), b = holdNet();
    expect(netBusy()).toBe(true);
    a(); a();
    expect(netBusy()).toBe(true);
    b();
    expect(netBusy()).toBe(false);
  });
  it("netFree: свободно — сразу; занято — когда отпустят; забыли отпустить — не дольше срока", async () => {
    let done = 0;
    await netFree();
    const off = holdNet();
    netFree().then(() => { done++; });
    await tick(20);
    expect(done).toBe(0);
    off();
    await tick(0);
    expect(done).toBe(1);
    holdNet();   // не отпускаем
    const t0 = Date.now();
    await netFree(40);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(35);
  });
  it("фото меню заранее: пока ролик держит связь — ни одного запроса; отпустил — качаем все", async () => {
    const calls = [];
    const off = holdNet();
    const run = photosAhead(["a", "b", "c", "d"], { fetchFn: async (u) => { calls.push(u); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; }, par: 2 });
    await tick(30);
    expect(calls).toEqual([]);
    off();
    expect(await run).toBe(4);
    expect(calls.sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("фото уроков заранее (aheadPool): то же — ждут ролик, потом все по порядку", async () => {
    const got = [];
    const off = holdNet();
    const run = aheadPool([1, 2, 3, 4, 5], async (id) => { got.push(id); }, 3);
    await tick(30);
    expect(got).toEqual([]);
    off();
    await run;
    expect(got).toEqual([1, 2, 3, 4, 5]);
  });
  it("кружки команды заранее ждут свободную связь; заготовка ролика и плеер держат связь", () => {
    expect(rd("lib/staff-photo.js")).toContain("netFree().then(() => aheadStaffThumbs(list, { lean: leanNet() }))");
    const w = rd("lib/intro-warm.js");
    expect(w).toContain("const free = holdNet();   // v226: пока качается — фото «заранее» ждут");
    expect(w).toMatch(/finally \{\n    free\(\);\n  \}/);
    const p = rd("ui/intro-video.jsx");
    expect(p).toContain("const free = holdNet();");
    expect(p).toContain("clearInterval(watch);\n      el.removeEventListener(\"progress\", onData);\n      free();");
  });
});

describe("v226 · ролик из памяти не пошёл — дальше из сети (lib/intro-warm.js)", () => {
  const v = INTRO_VIDEOS["s0-1"];
  const okBody = () => new Response(new Blob([new Uint8Array(2048)], { type: "video/mp4" }), { status: 200, headers: { "Content-Type": "video/mp4" } });
  let fetches;
  beforeEach(() => {
    resetIntroWarm();
    resetNetQuiet();
    fetches = 0;
    globalThis.localStorage = memStore();
    globalThis.fetch = async () => { fetches++; return okBody(); };
    globalThis.caches = { open: async () => ({ match: async () => undefined, put: async () => {}, delete: async () => true, keys: async () => [] }) };
    try { Object.defineProperty(globalThis.navigator, "connection", { configurable: true, value: undefined }); } catch (e) { /* */ }
  });
  it("запомнили — по версии браузера; другая версия (обновили iOS) — пробуем снова", () => {
    expect(blobBad()).toBe(false);
    markBlobBad();
    expect(blobBad()).toBe(true);
    expect(globalThis.localStorage.getItem(BLOB_BAD)).toBe(String(globalThis.navigator.userAgent).slice(0, 240));
    globalThis.localStorage.setItem(BLOB_BAD, "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X)");
    expect(blobBad()).toBe(false);
  });
  it("обычный телефон — как раньше: заготовка, плеер из памяти", async () => {
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("ready");
    expect(introSrc(v)).toMatch(/^blob:/);
  });
  it("телефон, где из памяти не играет: заранее не качаем, плеер — из сети", async () => {
    markBlobBad();
    const off = warmIntro(v, { wait: 0 });
    await settle();
    expect(typeof off).toBe("function");
    expect(fetches).toBe(0);
    expect(introWarmState(v)).toBe("");
    expect(introSrc(v)).toBe(v.src);
  });
  it("заготовка уже готова, а телефон оказался «не играет» — плеер всё равно из сети", async () => {
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introSrc(v)).toMatch(/^blob:/);
    markBlobBad();
    expect(introSrc(v)).toBe(v.src);
  });
  it("пока заготовка качается, связь занята; скачалась — свободна", async () => {
    let release;
    globalThis.fetch = () => new Promise((res) => { release = () => res(okBody()); });
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("net");
    expect(netBusy()).toBe(true);
    release();
    await settle();
    expect(introWarmState(v)).toBe("ready");
    expect(netBusy()).toBe(false);
  });
  it("скачать не вышло — связь тоже отпускаем", async () => {
    globalThis.fetch = async () => new Response("нет", { status: 404 });
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("off");
    expect(netBusy()).toBe(false);
  });
});

describe("v226 · сторож в плеере (ui/intro-video.jsx)", () => {
  const P = () => { const s = rd("ui/intro-video.jsx"); return s.slice(s.indexOf("export function IntroPlayer(")); };
  it("сроки: из памяти — 2,5 с, из сети — 7 с без байта и кадра, два раза, подпись — через 6 с", () => {
    expect(BLOB_WAIT).toBe(2500);
    expect([NET_STUCK, NET_RETRY, SLOW_HINT, WATCH_MS]).toEqual([7000, 2, 6000, 500]);
  });
  it("новый адрес того же ролика: ?r= или &r=", () => {
    expect(freshSrc("/video/intro-core.mp4", 1000)).toBe("/video/intro-core.mp4?r=rs");
    expect(freshSrc("/video/intro-core.mp4?x=1", 36)).toBe("/video/intro-core.mp4?x=1&r=10");
  });
  it("из памяти ни кадра за BLOB_WAIT — запомнить и в сеть; из сети залипло — заново новым адресом; на паузе сторож молчит", () => {
    const s = P();
    expect(s).toContain("if (el.paused || el.ended || el.error || t > lastT + 0.02) { lastT = t; waitAt = 0; setSlowOnce(false); return; }");
    expect(s).toContain("if (from === \"warm\" && t < 0.05 && now - waitAt >= BLOB_WAIT) {\n        markBlobBad();\n        fromNet();");
    expect(s).toContain("if (from === \"net\" && tries < NET_RETRY && now - waitAt >= NET_STUCK && now - dataAt >= NET_STUCK) {\n        tries++;\n        retry();");
    expect(s).toContain("el.src = freshSrc(video.src);");
    expect(s).toContain("el.addEventListener(\"progress\", onData);");
    expect(s).toContain("setSlowOnce(now - waitAt >= SLOW_HINT);");
  });
  it("подпись «Медленная связь — видео ещё грузится» — только пока ждём", () => {
    const s = P();
    expect(s).toContain("{state === \"waiting\" && slow ? (");
    expect(s).toContain("Медленная связь — видео ещё грузится");
    expect(s).toContain("data-intro-slow=\"\" role=\"status\"");
  });
});
