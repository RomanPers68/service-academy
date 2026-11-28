// e2e v226 (Доп. 552): видео-знакомство не стоит на круге ожидания. Владелец (29.11, запись с ярлыка на iPhone): «Теперь
// видео очень долго грузит 🥺 Это сохраненная ссылка 😉». Демо целиком (tools/claude/demo-app/build.mjs), урок по id —
// window.__saLesson; голова — из e2e-v177.mjs: свой сервер с Range, журнал запросов роликов. Разделы:
//   GOOD  — обычный телефон: ролик заранее, «из памяти» пошёл сразу, сторож не мешает, подписи «Медленная связь» нет;
//   BLOB  — ролик из памяти телефона «молчит» (адрес заготовки подменён на запрос, на который сервер не отвечает — так
//           ведёт себя iPhone, когда не играет blob:): через 2,5 с плеер сам берёт ролик из сети и играет; телефону
//           запомнено sa_intro_blob_bad, копия из телефона стёрта; после перезапуска заранее не качаем, ролик — сразу из сети;
//   NET   — первый запрос ролика из сети «залип» (сервер не отвечает): через 6 с подпись «Медленная связь — видео ещё
//           грузится», через 7 с — тот же ролик новым адресом (?r=), играет, подпись ушла;
//   QUIET — пока плеер открыт, фото меню «заранее» не качаются (связь — ролику); закрыл — качаются;
//   ERR   — ни одной ошибки страницы.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<снимки> E2E_SRC=<исходники> node e2e-v226.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5626, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v226";
const SRC = resolve(process.env.E2E_SRC || new URL("../..", import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const { INTRO_VIDEOS } = await import(pathToFileURL(join(SRC, "data/intro-videos.js")).href);
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
// сервер с Range; ролики — в журнал (range — плеер, без — заготовка; r — новый адрес). /__stall.mp4 — не отвечаем никогда
// («молчащий» ролик из памяти); STALL_NET — ролик без ?r= тоже не отвечаем («залипшая» загрузка)
const NET = [];
const HELD = [];
let STALL_NET = false;
const server = http.createServer((req, res) => {
  const q = req.url.split("?")[1] || "";
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/__stall.mp4") { NET.push({ p: "__stall.mp4", range: !!req.headers.range, r: false, t: Date.now() }); HELD.push(res); return; }
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const type = mime[extname(f)] || "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  const r = /(^|&)r=/.test(q);
  if (p.endsWith(".mp4")) {
    NET.push({ p: p.replace(/^.*\//, ""), range: !!m, r, t: Date.now() });
    if (STALL_NET && !r) { HELD.push(res); return; }
  }
  const buf = readFileSync(f);
  if (m) {
    const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${buf.length}`, "Content-Length": b - a + 1 });
    res.end(buf.subarray(a, b + 1));
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": buf.length }); res.end(buf);
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 700) : "")); } };
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const allErrs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KSENIA = "_Ксения_Миронова", SEEN_KEY = "sa_intro_seen";
const S01 = INTRO_VIDEOS["s0-1"];
const KEY01 = "intro-seasonal.mp4?rev=" + S01.rev;

const boot = async (page, errs) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate(() => localStorage.setItem("sa_lesson_cards", "1"));
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ who = "anna", init = null, tag = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => { errs.push(String(e.message).slice(0, 160)); allErrs.push((tag || who) + ": " + String(e.message).slice(0, 160)); });
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs);
  return { ctx, page, errs };
}
// новичок: у Ксении в демо пройден первый урок — делаем её «первый день» (как в e2e-v177.mjs)
async function newbie({ init = null, tag = "" } = {}) {
  const o = await open({ who: "ksenia", init, tag });
  await o.page.evaluate((k) => {
    const d = window.__demo;
    d.srv.S.progress["e-ksenia"] = [];
    if (d.srv.S.quizzes) d.srv.S.quizzes["e-ksenia"] = [];
    d.save();
    localStorage.setItem("sa_completed_Ксения_Миронова", "{}");
    localStorage.removeItem(k);
  }, SEEN_KEY + KSENIA);
  NET.length = 0;
  const t0 = Date.now();
  await o.page.reload({ waitUntil: "load" });
  await o.page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => o.errs.push("заставка не ушла"));
  await o.page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  return { ...o, t0 };
}
const lesson = async (page, id, ms = 1600) => { const r = await page.evaluate((x) => (window.__saLesson ? window.__saLesson(x) : false), id); await page.waitForTimeout(ms); return r; };
const player = (page) => page.evaluate(() => {
  const p = document.querySelector("[data-intro-player]");
  if (!p) return null;
  const v = p.querySelector("video[data-intro-el]");
  return { mode: p.getAttribute("data-intro-mode"), state: p.getAttribute("data-intro-state"), from: v ? v.getAttribute("data-intro-from") : "", src: v ? v.currentSrc || v.src : "",
    t: v ? v.currentTime : -1, slow: !!p.querySelector("[data-intro-slow]") };
});
const waitFor = async (page, fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await page.waitForTimeout(100); } return v; };
const going = (page, ms) => waitFor(page, async () => { const p = await player(page); return p && p.state === "playing" && p.t > 0.3 ? p : null; }, ms);
const cacheKeys = (page) => page.evaluate(async () => { try { const c = await caches.open("sa-video-v1"); return (await c.keys()).map((r) => r.url.replace(/^.*\/video\//, "")); } catch (e) { return ["err:" + e]; } });
const fulls = (since, name = "intro-seasonal.mp4") => NET.filter((x) => x.p === name && !x.range && x.t >= since).length;
const run = async (keys, fn) => { if (!keys.some(want)) return; try { await fn(); } catch (e) { ok(keys.join("/") + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });

// ── GOOD: обычный телефон ────────────────────────────────────────────────────────────────────────────────────
await run(["GOOD"], async () => {
  const o = await newbie({ tag: "good" });
  const got = await waitFor(o.page, async () => (await cacheKeys(o.page)).includes(KEY01), 12000);
  ok("GOOD: ролик заранее скачан и лежит в телефоне", !!got, { keys: await cacheKeys(o.page), net: NET.slice(0, 4) });
  const t1 = Date.now();
  await lesson(o.page, "s0-1", 200);
  const p = await going(o.page, 6000);
  ok("GOOD: ролик из памяти телефона пошёл сразу (" + (Date.now() - t1) + " мс)", !!p && p.from === "warm" && /^blob:/.test(p.src) && Date.now() - t1 < 3500, p);
  await o.page.waitForTimeout(3500);
  const q = await player(o.page);
  ok("GOOD: сторож не мешает — ролик идёт из памяти, подписи «Медленная связь» нет", !!q && q.from === "warm" && q.state === "playing" && !q.slow && q.t > 3, q);
  ok("GOOD: телефону ничего не запомнено", (await o.page.evaluate(() => localStorage.getItem("sa_intro_blob_bad"))) === null);
  await o.ctx.close();
});

// ── BLOB: ролик из памяти «молчит» ──────────────────────────────────────────────────────────────────────────
await run(["BLOB"], async () => {
  const stallBlob = `(() => { const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => (b && /^video\\//.test(b.type || "") ? location.origin + "/__stall.mp4?" + Math.random().toString(36).slice(2) : orig(b)); })();`;
  const o = await newbie({ init: stallBlob, tag: "blob" });
  const got = await waitFor(o.page, async () => (await cacheKeys(o.page)).includes(KEY01), 12000);
  ok("BLOB: заготовка скачана (в памяти — «молчащий» адрес)", !!got, await cacheKeys(o.page));
  const t1 = Date.now();
  await lesson(o.page, "s0-1", 200);
  const first = await waitFor(o.page, async () => { const p = await player(o.page); return p && p.from ? p : null; }, 3000);
  ok("BLOB: плеер начал с ролика из памяти", !!first && first.from === "warm" && /__stall\.mp4/.test(first.src), first);
  const p = await going(o.page, 9000);
  const dt = Date.now() - t1;
  ok("BLOB: через 2,5 с без кадра плеер сам взял ролик из сети и играет (" + dt + " мс)", !!p && p.from === "net" && /intro-seasonal\.mp4$/.test(p.src) && dt >= 2500 && dt < 7000, { p, dt });
  ok("BLOB: телефону запомнено — из памяти здесь не играет (по версии браузера)",
    (await o.page.evaluate(() => localStorage.getItem("sa_intro_blob_bad") === String(navigator.userAgent).slice(0, 240))) === true);
  const k = await waitFor(o.page, async () => !(await cacheKeys(o.page)).includes(KEY01), 3000);
  ok("BLOB: копию ролика из телефона стёрли", !!k, await cacheKeys(o.page));
  await shot(o.page, "blob-net");
  // перезапуск: заранее не качаем, ролик — сразу из сети
  await o.page.evaluate((key) => localStorage.removeItem(key), SEEN_KEY + KSENIA);
  const t2 = Date.now();
  await o.page.reload({ waitUntil: "load" });
  await o.page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await o.page.waitForTimeout(4500);
  ok("BLOB: после перезапуска ролик заранее не качаем", fulls(t2) === 0 && !(await cacheKeys(o.page)).includes(KEY01), NET.filter((x) => x.t >= t2));
  const t3 = Date.now();
  await lesson(o.page, "s0-1", 200);
  const p3 = await going(o.page, 8000);
  ok("BLOB: после перезапуска ролик сразу из сети и играет (" + (Date.now() - t3) + " мс)", !!p3 && p3.from === "net" && Date.now() - t3 < 4000, p3);
  await o.ctx.close();
});

// ── NET: первый запрос ролика «залип» ───────────────────────────────────────────────────────────────────────
await run(["NET"], async () => {
  // экономия трафика: заранее не качаем — плеер сразу из сети
  const lean = () => { try { Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }); } catch (e) { /* */ } };
  const o = await newbie({ init: lean, tag: "net" });
  await o.page.waitForTimeout(1500);
  STALL_NET = true;
  const t1 = Date.now();
  await lesson(o.page, "s0-1", 200);
  const hint = await waitFor(o.page, async () => { const p = await player(o.page); return p && p.slow ? Date.now() - t1 : null; }, 9000);
  ok("NET: ждём дольше 6 с — подпись «Медленная связь — видео ещё грузится» (" + hint + " мс)", !!hint && hint >= 5500 && hint < 9000,
    { hint, text: await o.page.evaluate(() => (document.querySelector("[data-intro-slow]") || {}).textContent || "") });
  ok("NET: подпись — та самая", /Медленная связь — видео ещё грузится/.test(await o.page.evaluate(() => (document.querySelector("[data-intro-slow]") || {}).textContent || "")));
  await shot(o.page, "net-slow");
  const p = await going(o.page, 9000);
  const dt = Date.now() - t1;
  ok("NET: через 7 с без байта — тот же ролик новым адресом, играет (" + dt + " мс)", !!p && p.from === "net" && /intro-seasonal\.mp4\?r=/.test(p.src) && dt >= 7000 && dt < 13000, { p, dt });
  ok("NET: в сеть ушёл запрос с новым адресом", NET.some((x) => x.t >= t1 && x.r && x.p === "intro-seasonal.mp4"), NET.filter((x) => x.t >= t1));
  await o.page.waitForTimeout(700);
  const q = await player(o.page);
  ok("NET: ролик пошёл — подпись ушла", !!q && !q.slow && q.state === "playing", q);
  STALL_NET = false;
  await o.ctx.close();
});

// ── QUIET: пока плеер открыт, фото меню заранее ждут ──────────────────────────────────────────────────────────
await run(["QUIET"], async () => {
  const IMG = readFileSync(join(SITE, "icons", readdirSync(join(SITE, "icons")).find((f) => /\.png$/.test(f))));
  const B = "https://photos.e2e/storage/v1/object/public/menu-photos/e2e/";
  const ADD = [1, 2, 3, 4, 5, 6].map((n) => ({ id: "e2e" + n, name: "Блюдо " + n, img: B + n + ".png" }));
  const o = await open({ who: "anna", tag: "quiet" });
  const hits = [];
  await o.ctx.route(B + "**", async (route) => { hits.push(Date.now()); await sleep(150); await route.fulfill({ status: 200, contentType: "image/png", body: IMG }); });
  // блюда с фото — в меню демо-сервера до запуска страницы (открытая страница сохраняет свой сервер поверх)
  await o.ctx.addInitScript((add) => { try {
    const S = JSON.parse(localStorage.getItem("__demo_srv") || "null");
    if (S && Array.isArray(S.menu)) { S.menu = S.menu.filter((d) => !/^e2e/.test(String(d.id))).concat(add); localStorage.setItem("__demo_srv", JSON.stringify(S)); }
  } catch (e) { /* */ } }, ADD);
  await o.page.evaluate(() => { localStorage.removeItem("sa_photo_ahead_v1"); localStorage.removeItem("sa_menu_shared"); localStorage.removeItem("sa_tip_sync"); });
  await o.page.reload({ waitUntil: "load" });
  const t0 = Date.now();
  await o.page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => o.errs.push("заставка не ушла"));
  await o.page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  await lesson(o.page, "c0-1", 200);
  const p = await going(o.page, 6000);
  ok("QUIET: плеер открыт, ролик идёт", !!p, p);
  // фото заранее начинаются через 7 с после запуска; держим плеер до 14-й секунды
  await sleep(Math.max(0, t0 + 14000 - Date.now()));
  const inMenu = await o.page.evaluate(() => { const sh = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); return Object.values(sh).flat().filter((d) => d && /\/e2e\//.test(d.img || "")).length; });
  ok("QUIET: блюда с фото в меню на телефоне есть (есть что качать)", inMenu >= 6, inMenu);
  ok("QUIET: пока плеер открыт — фото заранее не качаются", hits.length === 0, hits.length);
  const tClose = Date.now();
  await o.page.evaluate(() => document.querySelector("[data-intro-x]").click());   // кнопки погасли — жмём напрямую
  const got = await waitFor(o.page, async () => hits.length >= 6, 9000);
  ok("QUIET: закрыл ролик — фото заранее пошли (" + hits.length + ")", !!got && hits.every((t) => t >= tClose), { n: hits.length });
  await o.ctx.close();
});

if (want("ERR")) ok("ERR: ошибок страницы нет", allErrs.length === 0, allErrs.join(" | "));
for (const r of HELD) { try { r.destroy(); } catch (e) { /* */ } }
console.log("\n" + pass + " из " + (pass + fail) + " проверок прошли");
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
