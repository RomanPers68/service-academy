// e2e v70 (Доп. 383): «Приглашение» в тон плиток, пламя в строке напарника.
// Владелец (22.10): карточка «выбивается из основного стиля» → «тон, как у соседних плиток, но контуры и текстура как
// есть сейчас»; «свечка некрасивая, в обеих темах одинаковая палитра» → «давай пламя»; свободное место — «оставим как есть».
// Разделы:
//   TONE  — тёмная: фон карточки (текст и значки спрятаны) того же тона, что плитка «Книга отзывов»; текстура прежняя:
//           свет из левого верхнего угла, диагональ светлее — темнее — светлее;
//   LENS  — линза — то же стекло, что кнопка AI (стиль один в один); стекло видно на карточке, не темнее кнопки AI;
//   EDGE  — контуры прежние: золотая кромка, кольца у вырезов, вырезы-маска, рамка внутри, перфорация, тень, тиснение;
//   LIGHT — светлая тема: белая бумага и сургуч, как были;
//   PAIR  — строка напарника: пламя (горит) вместо свечи; в тёмной и светлой — своя палитра, пламя яркое, по центру строки;
//   FS    — полноэкранный Telegram: карточка под кнопками Telegram, тон тот же.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v70.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5270, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v70";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const OWNER = { id: "u-own", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true };
const uk = "_" + OWNER.name + "_";
const NOW = new Date("2026-10-21T22:34:00Z");        // 22.10 10:34 по Камчатке — до смены 26 мин
const TODAY = "2026-10-22", YDAY = "2026-10-21";
const DONE = { "spg-0-1": true, "spg-0-2": true, "spg-0-3": true, "spg-0-4": true, "spg-0-d": true };
const PAIR = { ok: true, quest: null, league: null, pair: { ok: true, pair: { partner: { name: "Иван" }, partner_today: { state: 2 }, me_today: { state: 0 }, streak: 2 } } };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sched = JSON.stringify({ cfg: { staff: [{ id: "s1", name: "Роман" }], shifts: [{ k: "Д", name: "День", from: 11, to: 24 }] }, plan: { s1: { 22: "Д", 23: "Д" } }, ts: NOW.getTime() });

// fs — заглушка полноэкранного Telegram (Bot API 8.0: строка состояния 62 + кнопки 46 px); pair — напарник уже занимался
async function open({ light = false, w = 440, h = 956, dsf = 2, fs = false, pair = false, look = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = { whoami: { ok: true, employee: OWNER }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: Object.keys(DONE), stars: {}, roles: [], last_role: "spg" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: [], ...(pair ? { day_brief: PAIR } : {}) };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(OWNER), sa_ai_fab: "1",
    ["sa_last_role" + uk]: JSON.stringify("spg"), ["sa_completed" + uk]: JSON.stringify(DONE), ["sa_goal" + uk]: "1",
    ["sa_activity" + uk]: JSON.stringify({ [YDAY]: { st: 2, l: 2 } }),
    sa_today_shift: JSON.stringify({ date: TODAY, label: "День · 11:00–24:00" }), "sa_sched_cache_main_2026-10": sched };
  if (look) seed.sa_home_look = look;   // v103: вид главной
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript(([seed, fs]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (!fs) return;
    const ev = {}, W = { platform: "ios", version: "9.6", initData: "", initDataUnsafe: {}, colorScheme: "dark", themeParams: {}, isFullscreen: false, isActive: true,
      safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 }, contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
      isVersionAtLeast() { return true; }, onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent(n, f) { ev[n] = (ev[n] || []).filter((g) => g !== f); },
      ready() {}, expand() {}, close() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {}, disableVerticalSwipes() {}, enableVerticalSwipes() {},
      requestFullscreen() { if (W.isFullscreen) return; setTimeout(() => { W.isFullscreen = true; W.safeAreaInset = { top: 62, bottom: 34, left: 0, right: 0 }; W.contentSafeAreaInset = { top: 46, bottom: 0, left: 0, right: 0 };
        ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged"].forEach((n) => (ev[n] || []).forEach((f) => f.call(W))); }, 50); },
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }, BackButton: { isVisible: false, show() {}, hide() {}, onClick() {}, offClick() {} },
      showAlert(m, cb) { if (cb) cb(); }, openLink() {}, openTelegramLink() {}, requestWriteAccess(cb) { if (cb) cb(false); } };
    window.Telegram = { WebApp: W };
  }, [seed, fs]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1800);
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const box = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, s);
// пиксели снимка экрана — через холст в той же странице (без лишних модулей); точки — в CSS-пикселях
const pixels = async (page, pts) => {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(([b64, pts]) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const k = img.width / innerWidth; res(pts.map(([x, y]) => Array.from(g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)))); };
    img.src = "data:image/png;base64," + b64;
  }), [png, pts]);
};
const avg = (list) => [0, 1, 2].map((i) => Math.round(list.reduce((s, p) => s + p[i], 0) / list.length));
const sum = (p) => p[0] + p[1] + p[2];
// только фон: текст, значки, линза, черта над «Дальше» и содержимое плитки спрятаны (как при замере тона для демо)
const BARE = "[data-now-card] *, [data-home-tiles] * { color: transparent !important; -webkit-text-fill-color: transparent !important; } [data-now-card] svg, [data-home-tiles] svg, [data-home-tiles] img, [data-now-lens] { visibility: hidden !important; } [data-now-card] [data-now-tag], [data-now-card] [data-now-title], [data-now-card] [data-now-sub], [data-now-card] [data-now-row] { background: none !important; } [data-now-card] [data-now-row] { border-color: transparent !important; } [data-tile=\"book\"] * { visibility: hidden !important; }";
const STUB = 100;

if (want("TONE")) {
  const o = await open({});
  await shot(o.page, "dark-home");
  await o.page.addStyleTag({ content: BARE }); await sleep(300);
  const c = await box(o.page, "[data-now-card]");
  const main = c.w - STUB;
  const grid = []; for (const fx of [0.12, 0.3, 0.5, 0.7, 0.88]) for (const fy of [0.3, 0.5, 0.7]) grid.push([c.x + main * fx, c.y + c.h * fy]);
  const tex = [[c.x + c.w * 0.2, c.y + 11], [c.x + main * 0.5, c.y + c.h * 0.5], [c.r - 12, c.b - 11]];
  const px = await pixels(o.page, [...grid, ...tex]);
  const card = avg(px.slice(0, grid.length)), [corner, mid, br] = px.slice(grid.length);
  await shot(o.page, "dark-bare");
  let t = await box(o.page, '[data-tile="book"]');
  if (!t || t.b > 956 - 90) { await o.page.evaluate(() => document.querySelector('[data-tile="book"]').scrollIntoView({ block: "center" })); await sleep(400); t = await box(o.page, '[data-tile="book"]'); }
  const tg = []; for (const fx of [0.3, 0.5, 0.7]) for (const fy of [0.35, 0.5, 0.65]) tg.push([t.x + t.w * fx, t.y + t.h * fy]);
  const tile = avg(await pixels(o.page, tg));
  ok("TONE: фон карточки в среднем — тон плитки «Книга отзывов» (разница по каналам не больше 10)", card.every((v, i) => Math.abs(v - tile[i]) <= 10), JSON.stringify({ card, tile }));
  ok("TONE: самое тёмное место диагонали — ровно тон плитки (разница не больше 5)", mid.every((v, i) => Math.abs(v - tile[i]) <= 5), JSON.stringify({ mid, tile }));
  ok("TONE: не почти чёрный, как был (на снимке владельца — rgb 16,12,5): заметно светлее", sum(card) >= 95, JSON.stringify(card));
  ok("TONE: текстура прежняя — свет из левого верхнего угла, диагональ светлее — темнее — светлее", sum(corner) - sum(mid) >= 12 && sum(br) - sum(mid) >= 3, JSON.stringify({ corner, mid, br }));
  ok("TONE: тёплый (красный > зелёный > синий), как плитки", card[0] > card[1] && card[1] > card[2] && tile[0] > tile[1] && tile[1] > tile[2], JSON.stringify({ card, tile }));
  ok("TONE: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("LENS")) {
  const o = await open({ dsf: 3 });
  const st = await o.page.evaluate(() => { const s = (q) => { const e = document.querySelector(q); if (!e) return null; const c = getComputedStyle(e); return [c.backgroundColor, c.backgroundImage, c.boxShadow]; }; return { lens: s("[data-now-lens]"), ai: s("[data-ai-disc]") }; });
  ok("LENS: линза — то же стекло, что кнопка AI: цвет стекла и кромки один в один, без подложки", st.lens && st.ai && st.lens[0] === st.ai[0] && st.lens[2] === st.ai[2] && st.lens[1] === "none", JSON.stringify(st));
  const L = await box(o.page, "[data-now-lens]"), A = await box(o.page, "[data-ai-disc]");
  const cy = L.y + L.h / 2, ay = A.y + A.h / 2;
  const [glass, beside, ai] = await pixels(o.page, [[L.x + L.w * 0.2, cy], [L.x - 10, cy], [A.x + A.w * 0.2, ay]]);
  ok("LENS: стекло линзы видно на карточке — светлее фона рядом", sum(glass) - sum(beside) >= 15, JSON.stringify({ glass, beside }));
  ok("LENS: линза не темнее кнопки AI на экране (v69: «не слишком тёмная»)", sum(glass) >= sum(ai) - 6, JSON.stringify({ glass, ai }));
  await o.page.screenshot({ path: OUT + "/lens.png", clip: { x: Math.max(0, L.x - 80), y: Math.max(0, L.y - 40), width: 200, height: 130 } });
  ok("LENS: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("EDGE")) {
  const o = await open({});
  const e = await o.page.evaluate(() => {
    const card = document.querySelector("[data-now-card]"), m = card.querySelector(":scope > div"), sh = card.querySelector("[data-now-shadow]");
    const cs = (x) => getComputedStyle(x);
    const spans = [...m.querySelectorAll("span")];
    const frame = spans.find((s) => cs(s).position === "absolute" && cs(s).top === "5px");
    const perf = spans.find((s) => cs(s).borderLeftStyle === "dotted");
    const title = card.querySelector("[data-now-title]");
    return { rim: cs(m).boxShadow, mask: cs(m).maskImage || cs(m).webkitMaskImage, bg: cs(m).backgroundImage, frame: frame ? cs(frame).border : null,
      perf: perf ? cs(perf).borderLeft : null, shadow: cs(sh).boxShadow, foil: cs(title).backgroundImage, clip: cs(title).webkitBackgroundClip || cs(title).backgroundClip };
  });
  ok("EDGE: золотая кромка (inset) и кольца у вырезов — как были", e.rim === "rgba(214, 178, 102, 0.38) 0px 0px 0px 1px inset" && (e.bg.match(/rgba\(214, 178, 102, 0\.38\) 9\.6px/g) || []).length === 2, JSON.stringify({ rim: e.rim, bg: e.bg.slice(0, 220) }));
  ok("EDGE: вырезы по линии отрыва — маской, как были", /radial-gradient/.test(e.mask || ""), String(e.mask).slice(0, 120));
  ok("EDGE: рамка внутри, перфорация и тень — как были", e.frame === "1px solid rgba(214, 178, 102, 0.42)" && e.perf === "2px dotted rgba(214, 178, 102, 0.45)" && e.shadow === "rgba(0, 0, 0, 0.6) 0px 10px 16px 0px", JSON.stringify({ frame: e.frame, perf: e.perf, shadow: e.shadow }));
  ok("EDGE: свет из угла и тон плиток в фоне; заголовок — золотое тиснение", /rgba\(214, 178, 102, 0\.1\)/.test(e.bg) && /rgba\(226, 186, 116, 0\.18\)/.test(e.bg) && !/rgb\(13, 9, 4\)/.test(e.bg) && /248, 232, 190/.test(e.foil) && e.clip === "text", JSON.stringify({ foil: e.foil.slice(0, 80), clip: e.clip }));
  const c = await box(o.page, "[data-now-card]");
  await o.page.screenshot({ path: OUT + "/card-dark.png", clip: { x: 0, y: Math.max(0, c.y - 20), width: 440, height: c.h + 40 } });
  ok("EDGE: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("LIGHT")) {
  // v103 (Доп. 416): в виде «Линза» на белой бумаге — линза (tools/claude/e2e-v103.mjs); сургуч — в виде «как сейчас»
  const o = await open({ light: true, look: "now" });
  const g = await o.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); const m = c.querySelector(":scope > div"); return { hero: c.getAttribute("data-hero"), bg: getComputedStyle(m).backgroundImage, seal: !!c.querySelector("[data-now-seal]"), lens: !!c.querySelector("[data-now-lens]") }; });
  ok("LIGHT: белая бумага (#FFFDF8 → #F7EEDC) и сургуч, как были; тона плиток тёмной темы нет", g.hero === "paper" && /255, 253, 248/.test(g.bg) && /247, 238, 220/.test(g.bg) && !/226, 186, 116/.test(g.bg) && g.seal && !g.lens, JSON.stringify({ ...g, bg: g.bg.slice(-120) }));
  const c = await box(o.page, "[data-now-card]");
  await o.page.screenshot({ path: OUT + "/card-light.png", clip: { x: 0, y: Math.max(0, c.y - 20), width: 440, height: c.h + 40 } });
  ok("LIGHT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("PAIR")) {
  const seen = {};
  for (const light of [false, true]) {
    const T = light ? "LIGHT" : "DARK";
    const o = await open({ light, pair: true, dsf: 3 });
    await o.page.waitForSelector(".sa-pairline", { timeout: 8000 }).catch(() => {});
    const r = await o.page.evaluate(() => {
      const l = document.querySelector(".sa-pairline"); if (!l) return null;
      const f = l.querySelector('[data-emb="flame"]'), lb = l.getBoundingClientRect(), fb = f ? f.getBoundingClientRect() : null;
      const stops = f ? [...f.querySelectorAll("linearGradient")[0].querySelectorAll("stop")].map((s) => s.getAttribute("stop-color")) : [];
      return { text: l.innerText.replace(/\s+/g, " ").trim(), flame: !!f, lit: f ? f.getAttribute("data-lit") : null, candle: !!l.querySelector("svg.candle"), stops,
        fb: fb && { x: fb.left, y: fb.top, w: fb.width, h: fb.height }, mid: lb.top + lb.height / 2, lb: { x: lb.left, y: lb.top, w: lb.width, h: lb.height } };
    });
    ok(`PAIR ${T}: строка напарника — пламя (горит), свечи нет`, r && r.flame && r.lit === "1" && !r.candle && /Иван/.test(r.text), JSON.stringify(r && { text: r.text, flame: r.flame, lit: r.lit, candle: r.candle }));
    if (r && r.fb) {
      ok(`PAIR ${T}: пламя по центру строки`, Math.abs(r.fb.y + r.fb.h / 2 - r.mid) <= 2, JSON.stringify({ flame: r.fb, mid: r.mid }));
      // самая яркая точка в пламени — светлое пламя, а не тёмный воск свечи
      const pts = []; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) pts.push([r.fb.x + r.fb.w * (0.1 + i * 0.1), r.fb.y + r.fb.h * (0.1 + j * 0.1)]);
      const px = await pixels(o.page, pts);
      const hi = px.reduce((a, p) => (sum(p) > sum(a) ? p : a), [0, 0, 0]);
      ok(`PAIR ${T}: пламя яркое и тёплое`, hi[0] >= 220 && hi[1] >= 150 && hi[0] >= hi[2], JSON.stringify(hi));
      seen[T] = r.stops;
      await o.page.screenshot({ path: OUT + "/pair-" + T.toLowerCase() + ".png", clip: { x: 0, y: Math.max(0, r.lb.y - 60), width: 440, height: r.lb.h + 120 } });
    }
    ok(`PAIR ${T}: без ошибок`, !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  ok("PAIR: в тёмной и светлой — своя палитра пламени (#FFE9AE… / #FFD27A…)", seen.DARK && seen.LIGHT && seen.DARK[0] === "#FFE9AE" && seen.LIGHT[0] === "#FFD27A", JSON.stringify(seen));
}

if (want("FS")) {
  const o = await open({ fs: true });
  const r = await o.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); const m = c.querySelector(":scope > div"); return { cls: document.documentElement.classList.contains("sa-tgfs"), st: document.documentElement.style.getPropertyValue("--sa-st"), top: Math.round(c.getBoundingClientRect().top), bg: getComputedStyle(m).backgroundImage }; });
  ok("FS: полноэкранный Telegram — карточка под кнопками Telegram (108 px), тон плиток", r.cls && r.st === "108px" && r.top >= 108 && /226, 186, 116, 0\.18/.test(r.bg), JSON.stringify({ ...r, bg: undefined }));
  await shot(o.page, "fs-home");
  ok("FS: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✓")).length} ✓ / ${results.filter((r) => r.startsWith("✗")).length} ✗`);
await browser.close();
server.close();
