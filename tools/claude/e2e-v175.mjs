// e2e v175 (Доп. 500): видео-знакомство — кнопки линзами, ▶ по центру, видео первым экраном, перемотка, кадр видео на
// обложке раздела. Демо целиком (tools/claude/demo-app/build.mjs), урок по id — window.__saLesson. Сервер отдаёт ролики
// кусками (Range), как Vercel. Правило телефона подменяется в странице (play): "ios" — со звуком только из касания, без
// звука — всегда (iPhone); "none" — ничего без касания (Telegram, где видео без касания не включается совсем).
//   TITLE   — урок с роликом открыли с начала: ролик сразу на весь экран, идёт со звуком; сверху «Читать текстом» (для
//             «Назад» Telegram), крестика нет; «Читать текстом» — текст урока, обложка на месте, выбор запомнен: урок
//             открывается текстом; у другого человека на том же телефоне — снова видео;
//   MUTED   — iPhone не дал звук без касания: ролик идёт без звука, посередине «Включить звук»; касание — со звуком и
//             с начала (первые секунды); с обложки — сразу со звуком (play() из касания);
//   BLOCKED — не включилось и без звука: кадр и ▶ посередине, «Читать текстом» сверху; ▶ — ролик идёт со звуком;
//   BACK    — «Назад» Telegram и Escape первым экраном — к тексту (запомнено); с обложки — только закрыть (не запомнено);
//   RESUME  — урок открыт с середины (место в уроке): видео первым экраном не встаёт, и на первой карточке тоже;
//   END     — досмотрел: «Ещё раз» и «К тексту урока»; запомнено «досмотрел», «текстом» его не перезаписывает;
//   SEEK    — «назад на фразу» (к началу звучащей фразы, только началась — к предыдущей), «вперёд на фразу», полоска:
//             касание, протяжка пальцем, стрелки; риски — начала фраз;
//   LENS    — кнопки плеера и нижняя строка обложки — линзы (стекло, золотой ободок, размытие под ним);
//   CENTER  — ▶ на обложке, посередине и внизу — центр тяжести треугольника в центре кружка;
//   COVERS  — шесть обложек: лицо над капсулой, кадр загрузился;
//   SECTION — раздел «Психология первого дня»: кадр видео обложкой, глаза над заголовком; раздел без ролика — как был;
//             билет «Начать» на главной кадр не берёт (лицо оказалось бы под кнопкой);
//   NARROW  — 320 px и «Для чтения»: плеер и обложка в экране, без прокрутки вбок; SHOTS — снимки для владельца.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> E2E_SRC=<исходники> node e2e-v175.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5675, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v175";
const SRC = resolve(process.env.E2E_SRC || new URL("../..", import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const { INTRO_VIDEOS } = await import(pathToFileURL(join(SRC, "data/intro-videos.js")).href);
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const type = mime[extname(f)] || "application/octet-stream";
  const buf = readFileSync(f);
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

const ANNA = "_Анна_Смирнова";
const SEEN_KEY = "sa_intro_seen";
const FIRST = Object.keys(INTRO_VIDEOS);
const allText = () => Object.fromEntries(FIRST.map((id) => [id, "text"]));

// правило телефона: "ios" — со звуком только из касания (и сразу после него), без звука — всегда; "none" — только из касания
function phoneRule(mode) {
  if (!mode) return;
  let last = -1e9;
  const mark = (e) => { if (e.isTrusted) last = performance.now(); };
  addEventListener("pointerdown", mark, true);
  addEventListener("touchstart", mark, true);
  addEventListener("keydown", mark, true);
  const orig = HTMLMediaElement.prototype.play;
  window.__e2ePlays = [];
  HTMLMediaElement.prototype.play = function () {
    const gesture = performance.now() - last < 1000;
    const okNow = mode === "ios" ? (this.muted || gesture) : gesture;
    window.__e2ePlays.push({ muted: this.muted, gesture, ok: okNow });
    if (!okNow) return Promise.reject(new DOMException("e2e: телефон не дал", "NotAllowedError"));
    return orig.call(this);
  };
}
const boot = async (page, errs, cards = true) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate((c) => localStorage.setItem("sa_lesson_cards", c ? "1" : "0"), cards);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ who = "anna", light = false, cards = true, width = 390, height = 844, dsf = 2, play = "", seen = null, pos = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  await ctx.addInitScript(phoneRule, play);
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs, cards);
  // демо готовит телефон заново (boot.js, seed) — выбор и место в уроке ставим уже после
  await page.evaluate(([s, p, k, uk]) => { if (s) localStorage.setItem(k + uk, JSON.stringify(s)); if (p) localStorage.setItem("sa_card_pos" + uk, JSON.stringify(p)); },
    [seen, pos, SEEN_KEY, ANNA]);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const lesson = async (page, id, ms = 1600) => { const r = await page.evaluate((x) => (window.__saLesson ? window.__saLesson(x) : false), id); await page.waitForTimeout(ms); return r; };
const shot = async (page, n) => { await page.waitForTimeout(250); await page.screenshot({ path: OUT + "/" + n + ".png" }).catch(() => {}); };
const seenOf = (page, uk = ANNA) => page.evaluate(([k]) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return { bad: true }; } }, [SEEN_KEY + uk]);
const cover = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-intro-cover]");
  if (!el) return null;
  const r = el.getBoundingClientRect(), img = el.querySelector("img"), bar = el.querySelector("[data-intro-bar]");
  const br = bar ? bar.getBoundingClientRect() : null;
  return { role: el.getAttribute("data-intro-cover"), w: r.width, h: r.height, top: r.top, left: r.left, right: r.right,
    img: img ? { src: img.getAttribute("src"), nw: img.naturalWidth, done: img.complete, pos: img.style.objectPosition } : null,
    bar: br ? { t: br.top - r.top, b: r.bottom - br.bottom, l: br.left - r.left, r: r.right - br.right, h: br.height } : null };
});
const player = (page) => page.evaluate(() => {
  const p = document.querySelector("[data-intro-player]");
  if (!p) return null;
  const q = (s) => p.querySelector(s);
  const v = q("video[data-intro-el]"), r = p.getBoundingClientRect(), x = q("[data-intro-x]");
  return { role: p.getAttribute("data-intro-player"), mode: p.getAttribute("data-intro-mode"), state: p.getAttribute("data-intro-state"), muted: p.getAttribute("data-intro-muted") === "1",
    inBody: p.parentElement === document.body, full: Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1,
    src: v ? (v.getAttribute("data-intro-from") === "warm" ? v.getAttribute("data-intro-src") : v.currentSrc || v.src) : "",   // v177: из памяти телефона (blob:) — файл в data-intro-src
    t: v ? v.currentTime : -1, paused: v ? v.paused : null, vmuted: v ? v.muted : null, dur: v ? v.duration : 0,
    fill: q("[data-intro-fill]") ? parseFloat(q("[data-intro-fill]").style.width) : -1, now: (q("[data-intro-now]") || {}).textContent || "",
    x: x ? x.getAttribute("data-intro-x") : null, xBack: !!q("[data-intro-x][data-sa-back]"), xText: x ? x.innerText.trim() : "", xLabel: x ? x.getAttribute("aria-label") : "",
    resume: !!q('[data-intro-toggle][aria-label="Смотреть"]'), sound: !!q("[data-intro-sound]"), wait: !!q("[data-intro-wait]"), end: (q("[data-intro-end]") || {}).innerText || "",
    ticks: p.querySelectorAll("[data-intro-cue]").length, controls: !!q("[data-intro-controls]") };
});
const waitFor = async (page, fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await page.waitForTimeout(120); } return v; };
const waitState = async (page, want, ms = 8000) => (await waitFor(page, async () => { const p = await player(page); return p && (want instanceof RegExp ? want.test(p.state) : p.state === want) ? p : null; }, ms)) || player(page);
const seek = (page, t) => page.evaluate((x) => new Promise((r) => { const v = document.querySelector("video[data-intro-el]"); const done = () => r(v.currentTime); v.addEventListener("seeked", done, { once: true }); v.currentTime = x; setTimeout(done, 1500); }), t);
const vt = (page) => page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); return v ? v.currentTime : -1; });
// v176 (Доп. 501): кнопки плеера гаснут через 3 с после начала — перед касанием кнопки показать их касанием по видео
// («Включить звук» не гаснет; касание по видео без звука включило бы звук — его не трогаем)
const reveal = async (page) => {
  const off = await page.evaluate(() => { const p = document.querySelector("[data-intro-player]"); return !!p && p.getAttribute("data-intro-ui") === "off"; });
  if (off) { await page.locator("[data-intro-stage]").first().tap({ position: { x: 30, y: 200 } }); await page.waitForTimeout(450); }
};
const tapCtl = async (page, sel) => { if (sel !== "[data-intro-sound]") await reveal(page); await page.locator(sel).first().tap(); };
// «Назад» Telegram: тот же поиск, что lib/utils.js clickScreenBack — сначала слои поверх приложения, потом #root
const tgBack = (page) => page.evaluate(() => {
  const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const root = document.getElementById("root");
  const layers = [...document.body.children].filter((el) => el !== root && el.tagName !== "SCRIPT").reverse();
  if (root) layers.push(root);
  const isBackText = (el) => { const t = (el.textContent || "").replace(/\s+/g, " ").trim(); return t === "‹" || t === "‹ Назад" || t === "←" || t === "← Назад"; };
  for (const layer of layers) {
    const marked = [...layer.querySelectorAll('[data-sa-back], [aria-label="Назад"]')].find(visible);
    if (marked) { const what = marked.getAttribute("data-intro-x") !== null ? "video:" + marked.getAttribute("data-intro-x") : "screen"; marked.click(); return what; }
    const byText = [...layer.querySelectorAll('button, [role="button"]')].find((el) => isBackText(el) && visible(el));
    if (byText) { byText.click(); return "screen"; }
  }
  return "none";
});
// линза: стекло (градиент), золотой ободок (inset-тень), размытие под ним
// v177 (Доп. 502): у кнопок плеера заливка и кромка — в [data-glass-skin] внутри кнопки, размытие — у самой кнопки
const lensOf = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el);
  const sk = getComputedStyle(el.querySelector(":scope > [data-glass-skin]") || el);
  return { bg: sk.backgroundImage, sh: sk.boxShadow, bf: cs.backdropFilter || cs.webkitBackdropFilter || "", color: cs.color, rad: cs.borderRadius }; }, sel);
const isLens = (l) => !!l && /gradient/.test(l.bg) && /inset/.test(l.sh) && /blur\(/.test(l.bf);
// ▶ по центру: центр тяжести треугольника (треть ширины от левого края) — в центре кружка
const center = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); const p = b && b.querySelector("[data-play-ic] path"); if (!p) return null;
  const r = b.getBoundingClientRect(), q = p.getBoundingClientRect();
  return { dx: +((q.left + q.width / 3) - (r.left + r.width / 2)).toFixed(2), dy: +((q.top + q.height / 2) - (r.top + r.height / 2)).toFixed(2), pad: getComputedStyle(b).paddingLeft }; }, sel);
// раздел сценария: упал — отмечаем и идём дальше
const run = async (keys, fn) => { if (!keys.some(want)) return; try { await fn(); } catch (e) { ok(keys.join("/") + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
// замена cueBack / cueNext из lib/intro-video.js (тут без сборки)
const LEAD = 0.15, r2 = (x) => Math.max(0, Math.round((x - LEAD) * 100) / 100);
const expBack = (c, t, grace = 1.2) => { let i = -1; c.forEach((x, k) => { if (x <= t + 0.05) i = k; }); if (i < 0) return 0; return r2(t - c[i] > grace ? c[i] : i > 0 ? c[i - 1] : LEAD); };
const expNext = (c, t) => { const n = c.find((x) => x > t + 0.3); return n == null ? null : r2(n); };

// ── TITLE ─────────────────────────────────────────────────────────────────────────────────────────────────
await run(["TITLE"], async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  ok("TITLE: урок новичка открыт", await lesson(page, "s0-1", 300));
  let p = await player(page);
  ok("TITLE: ролик сразу на весь экран, без касания обложки — первым экраном", !!p && p.mode === "title" && p.role === "seasonal" && p.inBody && p.full, p);
  p = await waitState(page, "playing");
  ok("TITLE: идёт со звуком", !!p && p.state === "playing" && !p.vmuted && !p.muted, p);
  ok("TITLE: сверху «Читать текстом» — для «Назад» Telegram; крестика нет", !!p && p.x === "text" && p.xBack && p.xText === "Читать текстом" && !(await page.$('[data-intro-x="close"]')), p);
  ok("TITLE: внизу капсула: назад на фразу, пауза, вперёд, время, полоска с рисками", !!p && p.controls && p.ticks >= 10 && !!(await page.$("[data-intro-back]")) && !!(await page.$("[data-intro-next]")) && !!(await page.$("[data-intro-seek][role=slider]")), p && p.ticks);
  await page.waitForTimeout(1800);
  await shot(page, "title-playing");
  const p2 = await player(page);
  ok("TITLE: время и полоска растут", !!p2 && p2.t > 1.2 && p2.fill > 2 && /^0:0[1-9]$/.test(p2.now), p2 && [p2.t, p2.fill, p2.now]);
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(500);
  ok("TITLE: «Читать текстом» — текст урока, обложка на месте", !(await player(page)) && !!(await cover(page)));
  ok("TITLE: выбор запомнен у Анны: «text»", (await seenOf(page))["s0-1"] === "text", await seenOf(page));
  const vl = await page.evaluate(() => !!document.querySelector("video[data-intro-el]"));
  ok("TITLE: ролик снят со страницы", !vl);
  await lesson(page, "s0-2", 900);
  await lesson(page, "s0-1", 900);
  ok("TITLE: урок снова — уже текстом, видео на обложке", !(await player(page)) && !!(await cover(page)));
  ok("TITLE: без ошибок страницы", errs.length === 0, errs);
  // другой человек (в демо — «Сменить» на Марию; демо при этом готовит телефон заново)
  await page.evaluate(() => localStorage.setItem("__demo_who", "maria"));
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs);
  await lesson(page, "s0-1", 300);
  const pm = await waitState(page, "playing");
  ok("TITLE: Мария на этом телефоне — у неё видео первым экраном", !!pm && pm.mode === "title", pm);
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(400);
  const keys = await page.evaluate((k) => Object.keys(localStorage).filter((x) => x.startsWith(k)), SEEN_KEY);
  ok("TITLE: выбор Марии — под её именем (как место в уроке)", keys.length === 1 && keys[0] === SEEN_KEY + "_Мария_Ким", keys);
  ok("TITLE: без ошибок страницы (Мария)", errs.length === 0, errs);
  await ctx.close();
});

// ── MUTED ─────────────────────────────────────────────────────────────────────────────────────────────────
await run(["MUTED"], async () => {
  const { ctx, page, errs } = await open({ play: "ios", dsf: 3 });
  await lesson(page, "spg-0-1", 300);
  const p = await waitState(page, "playing");
  ok("MUTED: iPhone не дал звук без касания — ролик идёт без звука (титры в кадре)", !!p && p.mode === "title" && p.state === "playing" && p.vmuted && p.muted, p);
  ok("MUTED: посередине «Включить звук» — линза", !!p && p.sound && isLens(await lensOf(page, "[data-intro-sound]")), p);
  await page.waitForTimeout(2200);
  await shot(page, "muted");
  const t0 = await vt(page);
  await tapCtl(page, "[data-intro-sound]");
  await page.waitForTimeout(700);
  const p2 = await player(page);
  ok("MUTED: касание — звук включён, ролик идёт", !!p2 && p2.state === "playing" && !p2.vmuted && !p2.sound, p2);
  ok("MUTED: в первые секунды — с начала («Привет!»)", t0 > 1.5 && !!p2 && p2.t < 1.5, { t0, t: p2 && p2.t });
  const plays = await page.evaluate(() => window.__e2ePlays);
  ok("MUTED: со звуком — только из касания", plays.filter((x) => !x.muted && x.ok).every((x) => x.gesture), plays);
  // посреди ролика звук — с начала звучащей фразы
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(400);
  await page.evaluate(([k, uk]) => localStorage.setItem(k + uk, "{}"), [SEEN_KEY, ANNA]);
  await lesson(page, "s0-2", 700); await lesson(page, "s0-1", 300);
  await waitState(page, "playing");
  const cues = INTRO_VIDEOS["s0-1"].cues;
  const at = await seek(page, 15.2);
  await page.waitForTimeout(300);
  const tt = await vt(page);
  await tapCtl(page, "[data-intro-sound]");
  await page.waitForTimeout(250);
  const t3 = await vt(page);
  ok("MUTED: посреди ролика «Включить звук» — с начала звучащей фразы", Math.abs(t3 - expBack(cues, tt, 0)) < 0.6 && t3 < tt, { at, tt, t3, exp: expBack(cues, tt, 0) });
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(400);
  // с обложки — сразу со звуком: play() из касания
  await page.locator("[data-intro-cover]").first().tap();
  const p4 = await waitState(page, "playing");
  ok("MUTED: с обложки — сразу со звуком, крестик", !!p4 && p4.mode === "view" && !p4.vmuted && !p4.sound && p4.x === "close" && p4.xLabel === "Закрыть", p4);
  await tapCtl(page, "[data-intro-x]");
  ok("MUTED: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── BLOCKED ───────────────────────────────────────────────────────────────────────────────────────────────
await run(["BLOCKED"], async () => {
  const { ctx, page, errs } = await open({ play: "none", dsf: 3 });
  await lesson(page, "m0-1", 300);
  const p = await waitState(page, "paused", 4000);
  ok("BLOCKED: не включилось и без звука — кадр, ▶ посередине, «Читать текстом» сверху", !!p && p.mode === "title" && p.state === "paused" && p.resume && p.x === "text" && !p.sound, p);
  await page.waitForTimeout(400);
  await shot(page, "blocked");
  await tapCtl(page, "[data-intro-toggle]");
  const p2 = await waitState(page, "playing", 5000);
  ok("BLOCKED: ▶ — ролик идёт со звуком", !!p2 && p2.state === "playing" && !p2.vmuted, p2);
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(400);
  ok("BLOCKED: «Читать текстом» — запомнено", (await seenOf(page))["m0-1"] === "text");
  ok("BLOCKED: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── BACK ──────────────────────────────────────────────────────────────────────────────────────────────────
await run(["BACK"], async () => {
  const { ctx, page, errs } = await open();
  await lesson(page, "c0-1", 300);
  await waitState(page, "playing");
  ok("BACK: «Назад» Telegram первым экраном — «Читать текстом»", (await tgBack(page)) === "video:text");
  await page.waitForTimeout(400);
  ok("BACK: урок на месте, текстом; запомнено", !(await player(page)) && !!(await cover(page)) && (await seenOf(page))["c0-1"] === "text");
  await page.evaluate(([k, uk]) => localStorage.setItem(k + uk, "{}"), [SEEN_KEY, ANNA]);
  await lesson(page, "c0-2", 700); await lesson(page, "c0-1", 300);
  await waitState(page, "playing");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("BACK: Escape — тоже к тексту, запомнено", !(await player(page)) && !!(await cover(page)) && (await seenOf(page))["c0-1"] === "text");
  await page.evaluate(([k, uk]) => localStorage.setItem(k + uk, "{}"), [SEEN_KEY, ANNA]);
  await lesson(page, "c0-2", 700); await lesson(page, "c0-1", 300);
  await waitState(page, "playing");
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(300);
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  ok("BACK: с обложки «Назад» Telegram — крестик видео", (await tgBack(page)) === "video:close");
  await page.waitForTimeout(400);
  ok("BACK: закрыто, урок на месте", !(await player(page)) && !!(await cover(page)));
  ok("BACK: «Назад» без видео — уже экран урока", (await tgBack(page)) === "screen");
  ok("BACK: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── RESUME ────────────────────────────────────────────────────────────────────────────────────────────────
await run(["RESUME"], async () => {
  // у урока хостес две карточки: место «вторая карточка» — 1
  const { ctx, page, errs } = await open({ pos: { "spg-0-1": 1 } });
  await lesson(page, "spg-0-1", 900);
  const banner = () => page.evaluate(() => { const t = [...document.querySelectorAll("span")].find((x) => /^Продолжаем с того же места/.test(x.textContent || "")); return t ? t.textContent.trim() : ""; });
  ok("RESUME: урок открыт с того места, где остановились", /карточка 2 из 2$/.test(await banner()), await banner());
  ok("RESUME: видео первым экраном не встало", !(await player(page)) && !(await cover(page)));
  await page.locator("[aria-label='Предыдущая карточка']").first().click().catch(() => {});
  await page.waitForTimeout(700);
  ok("RESUME: вернулся на первую карточку — обложка, а не видео на весь экран", !!(await cover(page)) && !(await player(page)));
  // «С начала» — урок с начала: видео первым экраном
  await page.evaluate(([uk]) => localStorage.setItem("sa_card_pos" + uk, JSON.stringify({ "spg-0-1": 1 })), [ANNA]);
  await lesson(page, "spg-0-2", 700); await lesson(page, "spg-0-1", 900);
  await page.locator("span[role=button]", { hasText: "С начала" }).first().click();
  const p = await waitState(page, "playing");
  ok("RESUME: «С начала» — урок с начала, видео первым экраном", !!p && p.mode === "title", p);
  ok("RESUME: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── END ───────────────────────────────────────────────────────────────────────────────────────────────────
await run(["END"], async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await lesson(page, "sm0-1", 300);
  await waitState(page, "playing");
  await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); v.currentTime = Math.max(0, v.duration - 0.8); });
  const p = await waitState(page, "ended", 6000);
  ok("END: досмотрел — «Ещё раз» и «К тексту урока»", !!p && p.state === "ended" && /Ещё раз/.test(p.end) && /К тексту урока/.test(p.end), p);
  ok("END: полоска — до конца", !!p && p.fill > 97, p && p.fill);
  ok("END: «Ещё раз» и «К тексту урока» — линзы", isLens(await lensOf(page, "[data-intro-again]")) && isLens(await lensOf(page, "[data-intro-done]")));
  await shot(page, "end");
  await tapCtl(page, "[data-intro-again]");
  await page.waitForTimeout(900);
  const p2 = await player(page);
  ok("END: «Ещё раз» — с начала и идёт", !!p2 && p2.state === "playing" && p2.t < 2.5, p2);
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(400);
  ok("END: досмотрел однажды — запомнено «end», хоть ушёл потом «Читать текстом»", (await seenOf(page))["sm0-1"] === "end", await seenOf(page));
  await lesson(page, "sm0-2", 700); await lesson(page, "sm0-1", 700);
  ok("END: урок снова — текстом, видео на обложке", !(await player(page)) && !!(await cover(page)));
  ok("END: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── SEEK ──────────────────────────────────────────────────────────────────────────────────────────────────
await run(["SEEK"], async () => {
  const { ctx, page, errs } = await open({ seen: allText() });
  await lesson(page, "s0-1");
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  const cues = INTRO_VIDEOS["s0-1"].cues;
  const ticks = await page.evaluate(() => [...document.querySelectorAll("[data-intro-cue]")].map((x) => parseFloat(x.style.left)));
  const expT = cues.filter((c) => c > 0.5 && c < INTRO_VIDEOS["s0-1"].dur - 0.5).map((c) => +(c / INTRO_VIDEOS["s0-1"].dur * 100).toFixed(2));
  ok("SEEK: риски на полоске — начала фраз", ticks.length === expT.length && ticks.every((x, i) => Math.abs(x - expT[i]) < 0.05), { ticks, expT });
  // пауза, чтобы время стояло
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "paused", 3000);
  // посреди фразы — к её началу
  let t = await seek(page, cues[5] + 2.5);
  await tapCtl(page, "[data-intro-back]");
  await page.waitForTimeout(500);
  let t2 = await vt(page);
  ok("SEEK: «назад на фразу» посреди фразы — к её началу", Math.abs(t2 - expBack(cues, t)) < 0.45, { t, t2, exp: expBack(cues, t) });
  const p = await player(page);
  ok("SEEK: после перемотки ролик идёт", !!p && p.state === "playing", p);
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "paused", 3000);
  // фраза только началась — к предыдущей
  t = await seek(page, cues[8] + 0.3);
  await tapCtl(page, "[data-intro-back]");
  await page.waitForTimeout(350);
  t2 = await vt(page);
  ok("SEEK: фраза только началась — «назад» к предыдущей", Math.abs(t2 - expBack(cues, t)) < 0.45 && t2 < cues[8] - 0.5, { t, t2, exp: expBack(cues, t) });
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "paused", 3000);
  t = await seek(page, cues[3] + 0.6);
  await tapCtl(page, "[data-intro-next]");
  await page.waitForTimeout(350);
  t2 = await vt(page);
  ok("SEEK: «вперёд на фразу» — к началу следующей", Math.abs(t2 - expNext(cues, t)) < 0.45, { t, t2, exp: expNext(cues, t) });
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "paused", 3000);
  // полоска: касание
  const box = await page.locator("[data-intro-seek]").boundingBox();
  const dur = INTRO_VIDEOS["s0-1"].dur;
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.waitForTimeout(400);
  t2 = await vt(page);
  ok("SEEK: касание полоски — туда", Math.abs(t2 - dur * 0.25) < 1.2, { t2, exp: dur * 0.25 });
  // протяжка
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) { await page.mouse.move(box.x + box.width * (0.3 + 0.04 * k), box.y + box.height / 2); await page.waitForTimeout(40); }
  await page.waitForTimeout(120);   // пока тянут, ролик перематывается не чаще раза в 60 мс — последний шаг ещё раз
  await page.mouse.move(box.x + box.width * 0.7 + 0.5, box.y + box.height / 2);
  const mid = await player(page);
  ok("SEEK: при протяжке полоска идёт за пальцем", !!mid && Math.abs(mid.fill - 70) < 3, mid && mid.fill);
  await shot(page, "seek-drag");
  await page.mouse.up();
  await page.waitForTimeout(400);
  t2 = await vt(page);
  ok("SEEK: отпустил — ролик там, где палец", Math.abs(t2 - dur * 0.7) < 1.2, { t2, exp: dur * 0.7 });
  const now = await player(page);
  ok("SEEK: время на капсуле — как у ролика", !!now && now.now === Math.floor(t2 / 60) + ":" + String(Math.floor(t2) % 60).padStart(2, "0"), now && now.now);
  // стрелки
  await page.locator("[data-intro-seek]").first().focus();
  const a0 = await vt(page);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  const a1 = await vt(page);
  ok("SEEK: стрелка влево — на 5 с назад", Math.abs(a0 - 5 - a1) < 0.6, { a0, a1 });
  const sl = await page.evaluate(() => { const s = document.querySelector("[data-intro-seek]"); return { now: s.getAttribute("aria-valuenow"), max: s.getAttribute("aria-valuemax"), text: s.getAttribute("aria-valuetext"), label: s.getAttribute("aria-label") }; });
  ok("SEEK: для экранного диктора — «Перемотка», сколько из скольки", sl.label === "Перемотка" && sl.max === String(dur) && (sl.text || "").endsWith(" из 0:" + String(dur).padStart(2, "0")), sl);
  ok("SEEK: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── LENS + CENTER ─────────────────────────────────────────────────────────────────────────────────────────
await run(["LENS", "CENTER"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 3 });
  await lesson(page, "spg-0-1");
  if (want("LENS")) {
    // v176 (Доп. 501): нижняя строка обложки — снова как в v174 (владелец: «мне нравился первый твой вариант»)
    const lb = await lensOf(page, "[data-intro-bar]"), lp = await lensOf(page, "[data-intro-play]");
    ok("LENS: нижняя строка обложки — как в v174, без стеклянной капсулы (v176)", !!lb && !/blur/.test(lb.bf) && lb.bg === "none", lb);
    ok("LENS: ▶ на обложке — тёмный кружок с золотой кромкой (v176)", !!lp && /rgba\(232, 201, 131, 0\.8\) 0px 0px 0px 1\.5px inset/.test(lp.sh), lp);
    const c = await cover(page);
    ok("LENS: строка — внизу обложки, поля 13 и 14 px (v176)", !!c && !!c.bar && Math.abs(c.bar.b - 13) < 1 && Math.abs(c.bar.l - 14) < 1 && Math.abs(c.bar.r - 14) < 1, c && c.bar);
  }
  if (want("CENTER")) {
    const c0 = await center(page, "[data-intro-play]");
    ok("CENTER: ▶ на обложке — по центру кружка, без отступа", !!c0 && Math.abs(c0.dx) <= 1 && Math.abs(c0.dy) <= 1 && c0.pad === "0px", c0);
  }
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  if (want("LENS")) {
    for (const [sel, name] of [["[data-intro-x]", "крестик"], ["[data-intro-back]", "назад на фразу"], ["[data-intro-toggle]", "пауза"], ["[data-intro-next]", "вперёд на фразу"], ["[data-intro-controls]", "капсула внизу"]]) {
      const l = await lensOf(page, sel);
      ok("LENS: " + name + " — линза", isLens(l), l);
    }
  }
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "paused", 3000);
  if (want("LENS")) ok("LENS: ▶ посередине — стеклянный пузырь, без кольца (v176)", isLens(await lensOf(page, "[data-intro-toggle]")) && !(await page.$("[data-intro-player] [data-lens-ring]")));
  if (want("CENTER")) {
    // v176: ▶ / ❚❚ — посередине экрана, одна кнопка
    const c1 = await center(page, "[data-intro-toggle]");
    ok("CENTER: ▶ посередине — по центру кружка", !!c1 && Math.abs(c1.dx) <= 1 && Math.abs(c1.dy) <= 1 && c1.pad === "0px", c1);
  }
  await shot(page, "paused");
  await tapCtl(page, "[data-intro-x]");
  ok("LENS/CENTER: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── COVERS ────────────────────────────────────────────────────────────────────────────────────────────────
await run(["COVERS"], async () => {
  const { ctx, page, errs } = await open({ seen: allText() });
  for (const id of FIRST) {
    const v = INTRO_VIDEOS[id];
    await lesson(page, id, 1300);
    await waitFor(page, async () => { const c = await cover(page); return c && c.img && c.img.done && c.img.nw > 0; }, 5000);
    const c = await cover(page);
    const geo = c && c.img ? (() => { const hs = c.w * 16 / 9, p = parseFloat(c.img.pos.split(" ")[1]) / 100, off = p * (hs - c.h);
      return { top: v.face.top * hs - off, eyes: v.face.eyes * hs - off, chin: v.face.chin * hs - off, barTop: c.h - c.bar.b - c.bar.h }; })() : null;
    ok("COVERS: " + id + " — кадр загрузился", !!c && c.img.done && c.img.nw === 720 && c.img.src.endsWith("intro-" + v.role + ".jpg"), c && c.img);
    ok("COVERS: " + id + " — лицо над капсулой (подбородок не под ней), глаза в кадре", !!geo && geo.chin <= geo.barTop + 4 && geo.eyes > 30, geo);
    ok("COVERS: " + id + " — высота обложки 72vw (230–310 px)", !!c && Math.abs(c.h - Math.min(310, Math.max(230, 0.72 * 390))) < 1.5, c && c.h);
  }
  ok("COVERS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── SECTION ───────────────────────────────────────────────────────────────────────────────────────────────
await run(["SECTION"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 3 });
  await lesson(page, "s0-1", 900);
  await page.evaluate(() => window.__saNav && window.__saNav("home"));
  await page.waitForTimeout(1800);
  const m = await waitFor(page, () => page.evaluate(() => {
    const x = [...document.querySelectorAll(".tbm-menu")].find((el) => (el.querySelector(".tbm-title") || {}).textContent === "Психология первого дня");
    if (!x) return null;
    const c = x.querySelector(".tbm-cover"), i = c && c.querySelector("img"), r = c ? c.getBoundingClientRect() : null;
    return { cover: x.getAttribute("data-mod-cover"), cur: !!x.closest(".tbp-cur"), src: i ? i.getAttribute("src") : "", nw: i ? i.naturalWidth : 0, pos: i ? i.style.objectPosition : "",
      w: r ? r.width : 0, h: r ? r.height : 0, wait: c ? c.querySelectorAll("[data-photo-wait]").length : -1, layers: c ? c.querySelectorAll("img").length : 0,
      note: (x.querySelector("[data-cover-edit]") || { getAttribute: () => null }).getAttribute("data-cover-edit") };
  }).then((v) => (v && v.nw > 0 ? v : null)), 6000);
  ok("SECTION: раздел «Психология первого дня» — обложка «кадр из видео»", !!m && m.cover === "video", m);
  ok("SECTION: кадр видео загрузился, без подложки-ожидания, одним слоем", !!m && /(^|\/)video\/intro-seasonal\.jpg$/.test(m.src) && m.nw === 720 && m.wait === 0 && m.layers === 1, m);
  const v = INTRO_VIDEOS["s0-1"];
  const eyes = m ? (() => { const hs = m.w * 16 / 9, p = parseFloat(m.pos.split(" ")[1]) / 100; return v.face.eyes * hs - p * (hs - m.h); })() : -1;
  ok("SECTION: глаза — над заголовком раздела (40–62 px от верха обложки)", eyes >= 40 && eyes <= 62, { eyes, m });
  if (m && m.cur) {
    const top = await page.evaluate(() => { const c = document.querySelector(".tbp-cur .tbm-cover"); const r = c.getBoundingClientRect(); return r.top; });
    await page.addStyleTag({ content: "#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
    await page.waitForTimeout(200);
    await page.screenshot({ path: OUT + "/section.png", clip: { x: 0, y: Math.max(0, top - 70), width: 390, height: 360 } }).catch(() => {});
  }
  const other = await page.evaluate(() => [...document.querySelectorAll(".tbm-menu")].filter((el) => el.getAttribute("data-mod-cover") === "video").map((el) => (el.querySelector(".tbm-title") || {}).textContent));
  ok("SECTION: кадр видео — только у раздела с видео-знакомством", other.length === 1 && other[0] === "Психология первого дня", other);
  ok("SECTION: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
  // билет «Начать»: кадр видео не берёт
  const r = await open({ who: "roman" });
  await r.page.evaluate(() => window.__saNav && window.__saNav("home")); await r.page.waitForTimeout(1500);
  const tk = await r.page.evaluate(() => ({ card: !!document.querySelector("[data-now-card]"), cover: (document.querySelector("[data-now-cover]") || { getAttribute: () => null }).getAttribute("data-now-cover") }));
  ok("SECTION: билет «Начать» на главной — без кадра видео (там лицо было бы под кнопкой)", tk.cover !== "video" && !(await r.page.$('[data-now-cover="video"]')), tk);
  ok("SECTION: без ошибок страницы (Роман)", r.errs.length === 0, r.errs);
  await r.ctx.close();
});

// ── NARROW / LIGHT ────────────────────────────────────────────────────────────────────────────────────────
await run(["NARROW"], async () => {
  for (const [name, o] of [["320", { width: 320, height: 640 }], ["light", { light: true }]]) {
    const { ctx, page, errs } = await open(o);
    await lesson(page, "bar0-1", 300);
    const p = await waitState(page, "playing");
    ok("NARROW " + name + ": видео первым экраном, на весь экран", !!p && p.mode === "title" && p.full, p);
    const fit = await page.evaluate(() => { const W = innerWidth, H = innerHeight; const out = [];
      for (const s of ["[data-intro-x]", "[data-intro-mute]", "[data-intro-controls]", "[data-intro-back]", "[data-intro-toggle]", "[data-intro-next]", "[data-intro-now]", "[data-intro-seek]", "[data-intro-left]"]) {
        const el = document.querySelector(s); if (!el) { out.push(s + ": нет"); continue; } const r = el.getBoundingClientRect(); if (r.left < 0 || r.right > W + 0.5 || r.top < 0 || r.bottom > H + 0.5 || r.width < 1) out.push(s + ": " + [r.left, r.right, r.top, r.bottom].map(Math.round)); }
      const seek = document.querySelector("[data-intro-seek]").getBoundingClientRect();
      return { out, seekW: Math.round(seek.width) }; });
    ok("NARROW " + name + ": кнопки и полоска — в экране, полоске хватает места", fit.out.length === 0 && fit.seekW >= 80, fit);
    await shot(page, "narrow-" + name);
    await tapCtl(page, "[data-intro-x]");
    await page.waitForTimeout(500);
    const c = await cover(page);
    ok("NARROW " + name + ": обложка в карточке, капсула в обложке", !!c && !!c.bar && c.bar.l >= 11 && c.bar.r >= 11, c);
    ok("NARROW " + name + ": без прокрутки вбок", !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    const ell = await page.evaluate(() => { const b = document.querySelector("[data-intro-bar]"); const d = b.querySelector("[data-intro-dur]"); const r = b.getBoundingClientRect(), q = d.getBoundingClientRect(); return q.right <= r.right && q.left >= r.left; });
    ok("NARROW " + name + ": длительность — внутри капсулы", ell);
    await shot(page, "narrow-" + name + "-cover");
    ok("NARROW " + name + ": без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
});

// ── SHOTS: для владельца (390 px, ×3) ─────────────────────────────────────────────────────────────────────
await run(["SHOTS"], async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  const clean = async () => { await page.addStyleTag({ content: "#demo-strip,#demo-tgchat,#demo-push{display:none!important}" }); await page.evaluate(() => document.documentElement.style.setProperty("--sa-st", "0px")); };
  await lesson(page, "spg-0-1", 300);
  await waitState(page, "playing");
  await clean();
  await seek(page, 11.2); await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + "/owner-1-title.png" });
  await tapCtl(page, "[data-intro-toggle]"); await waitState(page, "paused", 3000); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/owner-2-paused.png" });
  await tapCtl(page, "[data-intro-x]"); await page.waitForTimeout(700); await clean();
  await page.screenshot({ path: OUT + "/owner-3-lesson.png" });
  ok("SHOTS: снимки сделаны", true);
  ok("SHOTS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
