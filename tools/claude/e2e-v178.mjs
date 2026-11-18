// e2e v178 (Доп. 503): видео-знакомство — сброс прогресса возвращает ролик первым экраном, без чёрного экрана, ролик
// заранее надёжнее. Владелец (18.11): «Когда нажимаю на урок, видео не стартует сразу, как раньше», и следом: «я просто
// сделал сброс своего прогресса, а ролик остался просмотренным, поэтому и не запустился сразу». Демо целиком
// (tools/claude/demo-app/build.mjs), урок по id — window.__saLesson, сброс себя — window.__saResetSelf (App.jsx); голова
// сценария — как в e2e-v177.mjs.
//   RESET  — выбрала «Читать текстом» — урок открывается текстом (правило v175); сброс прогресса — выбор стёрт, ролик снова
//            первым экраном;
//   POSTER — ролик грузится долго (сервер держит куски): с первого мгновения на месте ролика кадр обложки — тот же размер и
//            место, касания проходят к видео; ролик пошёл — кадр тает; быстро грузится — кадр уходит сразу;
//   WARM   — начатое заранее скачивание доводится до конца, хоть человек и ушёл с главной; обложка в уроке берёт ролик сразу,
//            без очереди; закрыл ролик, не досмотрев, — обложка берёт его снова, следующий раз — из памяти;
//   SOUND  — нажал паузу, пока ролик первым экраном ещё грузился, — ролик стоит со звуком (до v178 шёл дальше без звука);
//   SHOTS  — снимки для владельца.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> E2E_SRC=<исходники> node e2e-v178.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5678, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v178";
const SRC = resolve(process.env.E2E_SRC || new URL("../..", import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const { INTRO_VIDEOS } = await import(pathToFileURL(join(SRC, "data/intro-videos.js")).href);
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
// сервер с Range; ролики — в журнал (с Range — плеер, без — заготовка). SLOW — держать заготовку, SLOWR — куски плеера (мс)
const NET = [];
let SLOW = 0, SLOWR = 0;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const type = mime[extname(f)] || "application/octet-stream";
  const buf = readFileSync(f);
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  const mp4 = p.endsWith(".mp4");
  if (mp4) NET.push({ p: p.replace(/^.*\//, ""), range: !!m, t: Date.now() });
  const later = (ms, fn) => (ms ? setTimeout(fn, ms) : fn());
  if (m) {
    const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    later(mp4 ? SLOWR : 0, () => { try { res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${buf.length}`, "Content-Length": b - a + 1 }); res.end(buf.subarray(a, b + 1)); } catch (e) { /* */ } });
    return;
  }
  later(mp4 ? SLOW : 0, () => { try { res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": buf.length }); res.end(buf); } catch (e) { /* */ } });
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

const ANNA = "_Анна_Смирнова", KSENIA = "_Ксения_Миронова";
const SEEN_KEY = "sa_intro_seen";
const FIRST = Object.keys(INTRO_VIDEOS);
const allText = () => Object.fromEntries(FIRST.map((id) => [id, "text"]));

const boot = async (page, errs, cards = true) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate((c) => localStorage.setItem("sa_lesson_cards", c ? "1" : "0"), cards);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ who = "anna", cards = true, width = 393, height = 852, dsf = 2, seen = null, pos = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs, cards);
  const uk = who === "ksenia" ? KSENIA : ANNA;
  await page.evaluate(([s, p, k, u]) => { if (s) localStorage.setItem(k + u, JSON.stringify(s)); if (p) localStorage.setItem("sa_card_pos" + u, JSON.stringify(p)); }, [seen, pos, SEEN_KEY, uk]);
  return { ctx, page, errs };
}
// новичок: у Ксении в демо пройден первый урок — делаем «первый день» (как в e2e-v177.mjs)
async function newbie() {
  const o = await open({ who: "ksenia" });
  await o.page.evaluate((k) => { const d = window.__demo; d.srv.S.progress["e-ksenia"] = []; if (d.srv.S.quizzes) d.srv.S.quizzes["e-ksenia"] = []; d.save();
    localStorage.setItem("sa_completed_Ксения_Миронова", "{}"); localStorage.removeItem(k); }, SEEN_KEY + KSENIA);
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
  return { role: p.getAttribute("data-intro-player"), mode: p.getAttribute("data-intro-mode"), state: p.getAttribute("data-intro-state"), ui: p.getAttribute("data-intro-ui"),
    from: v ? v.getAttribute("data-intro-from") : "", src: v ? v.currentSrc || v.src : "", t: v ? v.currentTime : -1 };
});
const cover = (page) => page.evaluate(() => !!document.querySelector("[data-intro-cover]"));
const waitFor = async (page, fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await page.waitForTimeout(80); } return v; };
const waitState = async (page, want, ms = 8000) => (await waitFor(page, async () => { const p = await player(page); return p && (want instanceof RegExp ? want.test(p.state) : p.state === want) ? p : null; }, ms)) || player(page);
const seenOf = (page, uk = ANNA) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return { bad: true }; } }, SEEN_KEY + uk);
const cacheKeys = (page) => page.evaluate(async () => { try { const c = await caches.open("sa-video-v1"); return (await c.keys()).map((r) => r.url.replace(/^.*\/video\//, "")); } catch (e) { return ["err:" + e]; } });
const fulls = (since = 0, name) => NET.filter((x) => x.p === name && !x.range && x.t >= since).length;
const run = async (keys, fn) => { if (!keys.some(want)) return; try { await fn(); } catch (e) { ok(keys.join("/") + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
// кадр обложки в плеере: виден ли, где, совпадает ли с местом видео
const poster = (page) => page.evaluate(() => {
  const i = document.querySelector("[data-intro-player] [data-intro-poster]"), v = document.querySelector("video[data-intro-el]");
  if (!i || !v) return null;
  const a = i.getBoundingClientRect(), b = v.getBoundingClientRect(), cs = getComputedStyle(i);
  return { on: i.getAttribute("data-intro-poster"), op: Number(cs.opacity), pe: getComputedStyle(i.parentElement).pointerEvents, done: i.complete && i.naturalWidth === 720,
    same: Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1, src: i.getAttribute("src"),
    vt: v.currentTime, paused: v.paused };
});

// ── RESET: сброс прогресса — ролик снова первым экраном ─────────────────────────────────────────────────────
await run(["RESET"], async () => {
  const { ctx, page, errs } = await open();
  await lesson(page, "c0-1", 300);
  let p = await waitState(page, "playing");
  ok("RESET: урок с роликом — видео первым экраном", !!p && p.mode === "title", p);
  await page.locator("[data-intro-x]").first().tap();
  await page.waitForTimeout(500);
  ok("RESET: «Читать текстом» — выбор запомнен", (await seenOf(page))["c0-1"] === "text", await seenOf(page));
  await lesson(page, "c0-2", 700); await lesson(page, "c0-1", 900);
  ok("RESET: урок снова — текстом, ролик на обложке (правило v175)", !(await player(page)) && (await cover(page)));
  const ready = await page.evaluate(() => typeof window.__saResetSelf === "function");
  await page.evaluate(() => window.__saResetSelf());
  await page.waitForTimeout(1200);
  ok("RESET: сброс прогресса стёр и выбор в видео-знакомстве", ready && !(("sa_intro_seen" + "_Анна_Смирнова") in (await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, 1]))))),
    await page.evaluate(() => Object.keys(localStorage).filter((k) => /intro_seen/.test(k))));
  await lesson(page, "c0-2", 700); await lesson(page, "c0-1", 300);
  p = await waitState(page, "playing");
  ok("RESET: после сброса — ролик снова первым экраном", !!p && p.mode === "title", p);
  ok("RESET: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── POSTER: пока ролик грузится — кадр обложки, а не чёрный экран ─────────────────────────────────────────────
await run(["POSTER"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 2 });
  await lesson(page, "m0-1", 1300);
  SLOWR = 1600;   // куски ролика сервер отдаёт через 1,6 с
  await page.locator("[data-intro-cover]").first().tap();
  await page.waitForTimeout(350);
  const a = await poster(page);
  const pa = await player(page);
  ok("POSTER: ролик ещё грузится — на его месте кадр обложки (тот же файл, что на обложке)", !!a && a.on === "on" && a.op === 1 && a.done && /intro-manager\.jpg$/.test(a.src) && a.vt === 0, { a, pa });
  ok("POSTER: кадр обложки — того же размера и там же, где видео (на весь экран, титры целиком)", !!a && a.same, a);
  ok("POSTER: касания проходят сквозь кадр к видео", !!a && a.pe === "none");
  await page.screenshot({ path: OUT + "/poster-loading.png" });
  SLOWR = 0;
  const b = await waitFor(page, async () => { const x = await poster(page); return x && x.on === "off" && x.op === 0 ? x : null; }, 6000);
  const pb = await player(page);
  ok("POSTER: ролик пошёл — кадр обложки растаял", !!b && !!pb && pb.state === "playing" && b.vt > 0, { b, pb });
  ok("POSTER: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
  // ролик грузится быстро — кадр уходит сразу
  const o = await open({ seen: allText() });
  await lesson(o.page, "bar0-1", 1300);
  const t0 = Date.now();
  await o.page.locator("[data-intro-cover]").first().tap();
  const c = await waitFor(o.page, async () => { const x = await poster(o.page); return x && x.on === "off" ? x : null; }, 5000);
  const dt = Date.now() - t0;
  ok("POSTER: ролик рядом — кадр обложки уходит сразу (" + dt + " мс)", !!c && dt < 1500, { c, dt });
  ok("POSTER: без ошибок страницы (быстро)", o.errs.length === 0, o.errs);
  await o.ctx.close();
});

// ── WARM: ролик заранее надёжнее ──────────────────────────────────────────────────────────────────────────────
await run(["WARM"], async () => {
  // начатое скачивание доводится до конца, хоть человек и ушёл с главной
  SLOW = 2500;
  let o = await newbie();
  const started = await waitFor(o.page, async () => fulls(o.t0, "intro-seasonal.mp4") > 0, 8000);
  await lesson(o.page, "s0-2", 300);   // ушёл с главной в урок без ролика
  const kept = await waitFor(o.page, async () => (await cacheKeys(o.page)).includes("intro-seasonal.mp4?rev=" + INTRO_VIDEOS["s0-1"].rev), 6000);
  ok("WARM: ушёл с главной, пока ролик качался, — скачивание довели, ролик в телефоне", !!started && !!kept, { started, keys: await cacheKeys(o.page) });
  ok("WARM: скачан один раз", fulls(o.t0, "intro-seasonal.mp4") === 1, NET.slice(0, 4));
  SLOW = 0;
  await lesson(o.page, "s0-1", 300);
  const p1 = await waitState(o.page, "playing", 6000);
  ok("WARM: урок с роликом — из памяти телефона", !!p1 && p1.from === "warm" && /^blob:/.test(p1.src), p1);
  ok("WARM: без ошибок страницы (ушёл с главной)", o.errs.length === 0, o.errs);
  await o.ctx.close();

  // обложка в уроке — без очереди; закрыл, не досмотрев, — берёт снова; следующий раз — из памяти
  SLOW = 3000;
  const a = await open({ pos: { "spg-0-1": 1 } });
  await lesson(a.page, "spg-0-1", 900);
  const t1 = Date.now();
  await a.page.locator("[aria-label='Предыдущая карточка']").first().click().catch(() => {});
  const fast = await waitFor(a.page, async () => (fulls(t1, "intro-spg.mp4") > 0 ? Date.now() - t1 : 0), 4000);
  ok("WARM: обложка в уроке берёт ролик сразу, без очереди (" + fast + " мс)", !!fast && fast < 900, { fast, net: NET.filter((x) => x.t >= t1) });
  await a.page.locator("[data-intro-cover]").first().tap();
  const p2 = await waitState(a.page, "playing", 6000);
  ok("WARM: коснулся раньше, чем скачалось, — ролик из сети", !!p2 && p2.from === "net", p2);
  SLOW = 0;
  await a.page.waitForTimeout(800);
  // кнопки погасли — показать касанием по видео (на экране — касание спрятало бы их)
  if (await a.page.evaluate(() => document.querySelector("[data-intro-player]").getAttribute("data-intro-ui") === "off")) {
    await a.page.locator("[data-intro-stage]").first().tap({ position: { x: 30, y: 200 } });
    await a.page.waitForTimeout(450);
  }
  const t2 = Date.now();
  await a.page.locator("[data-intro-x]").first().tap();
  const again = await waitFor(a.page, async () => (await cacheKeys(a.page)).includes("intro-spg.mp4?rev=" + INTRO_VIDEOS["spg-0-1"].rev), 6000);
  ok("WARM: закрыл, не досмотрев, — обложка взяла ролик снова, он в телефоне", !!again && fulls(t2, "intro-spg.mp4") === 1 && (await seenOf(a.page))["spg-0-1"] === undefined, { again, net: NET.filter((x) => x.t >= t2) });
  await a.page.locator("[data-intro-cover]").first().tap();
  const p3 = await waitState(a.page, "playing", 6000);
  ok("WARM: следующий раз — из памяти телефона", !!p3 && p3.from === "warm", p3);
  ok("WARM: без ошибок страницы (обложка)", a.errs.length === 0, a.errs);
  await a.ctx.close();
});

// ── SOUND: долгая загрузка не глушит ролик ─────────────────────────────────────────────────────────────────────
// Первым экраном play() ждёт, пока ролик грузится. Нажали паузу раньше — play() отменён (AbortError). До v178 плеер
// принимал это за «телефон не дал звук», выключал звук и пускал ролик дальше без звука.
await run(["SOUND"], async () => {
  const { ctx, page, errs } = await open();
  SLOWR = 2500;
  await lesson(page, "sm0-1", 200);
  await waitFor(page, async () => (await player(page)) && (await page.evaluate(() => document.querySelector("[data-intro-player]").getAttribute("data-intro-ui") === "on")), 3000);
  const before = await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); return { paused: v.paused, muted: v.muted, t: v.currentTime }; });
  await page.locator("[data-intro-toggle]").first().tap();
  SLOWR = 0;
  await page.waitForTimeout(2600);
  const after = await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); return { paused: v.paused, muted: v.muted, t: v.currentTime,
    pill: !!document.querySelector("[data-intro-sound]"), state: document.querySelector("[data-intro-player]").getAttribute("data-intro-state") }; });
  ok("SOUND: ролик ещё грузился, когда нажали паузу", !before.paused && before.t === 0, before);
  ok("SOUND: пауза — ролик стоит со звуком, не идёт без звука и без «Включить звук»", after.paused && !after.muted && !after.pill && after.state === "paused", after);
  await page.locator("[data-intro-toggle]").first().tap();
  const p = await waitState(page, "playing", 6000);
  const m = await page.evaluate(() => document.querySelector("video[data-intro-el]").muted);
  ok("SOUND: ▶ — идёт со звуком", !!p && !m, { p, m });
  ok("SOUND: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── SHOTS ─────────────────────────────────────────────────────────────────────────────────────────────────────
await run(["SHOTS"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 3 });
  await page.addStyleTag({ content: "#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
  await page.evaluate(() => document.documentElement.style.setProperty("--sa-st", "54px"));
  await lesson(page, "spg-0-1", 1300);
  SLOWR = 2500;
  await page.locator("[data-intro-cover]").first().tap();
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + "/owner-loading.png" });
  SLOWR = 0;
  ok("SHOTS: снимки сделаны", true);
  ok("SHOTS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
