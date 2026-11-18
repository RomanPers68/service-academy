// e2e v176 (Доп. 501): видео-знакомство — новые ролики и плеер по образцу iPhone. Владелец (18.11): «Давай сделаем линзы без
// дополнительного обруча, более прозрачными. И что бы видео было на весь экран, и после начала, все элементы изчезали,
// с аккуратной анимацией. <…> И да, с дополнительной кнопкой динамика». Демо целиком (tools/claude/demo-app/build.mjs),
// урок по id — window.__saLesson; голова сценария (сервер с Range, правило телефона play: "ios" / "none") — как в
// e2e-v175.mjs.
//   FILL   — видео на весь экран: 393×852 — по ширине без полей, полоски сверху и снизу до 40 px; 393×760 (с шапкой
//            Telegram) — весь экран; 320×640; повёрнутый телефон — почти весь кадр; вшитые титры всегда целиком (видно
//            не меньше 90 % ширины и 92 % высоты кадра);
//   HIDE   — ролик пошёл: кнопки на экране 3,2 с, потом плавно гаснут (прозрачность и сдвиг 0,35 с) и не ловят касаний;
//            касание по видео — снова, ещё касание — гаснут сразу, сами — через 2,6 с; на паузе, пока тянут полоску и в
//            конце — на экране; «уменьшить движение» — одной прозрачностью;
//   MUTE   — динамик сверху справа: выключить и включить звук; выключил сам — без просьбы «Включить звук»; звук выключил
//            телефон — динамик перечёркнут, «Включить звук» не гаснет, касание динамика — звук с начала фразы;
//   GLASS  — кнопки без колец и золотого ободка, светлая кромка, заливка не плотнее 45 %, размытие; посередине ▶ 82 px
//            и фразы 58 px, ▶ по центру кружка;
//   COVER  — обложка в уроке как в v174: ▶ 48 px в тёмном кружке с золотой кромкой, подпись, «0:55», ▶ по центру;
//   VIDEOS — шесть новых роликов: длительность совпадает с данными, «Начнём!» за 1–2,5 с до конца;
//   NARROW — 320 px; SHOTS — снимки для владельца.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> E2E_SRC=<исходники> node e2e-v176.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5676, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v176";
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
async function open({ who = "anna", light = false, cards = true, width = 393, height = 852, dsf = 2, play = "", seen = null, pos = null, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka",
    reducedMotion: reduce ? "reduce" : "no-preference" });
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
    src: v ? v.currentSrc || v.src : "", t: v ? v.currentTime : -1, paused: v ? v.paused : null, vmuted: v ? v.muted : null, dur: v ? v.duration : 0,
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
const lensOf = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el);
  return { bg: cs.backgroundImage, sh: cs.boxShadow, bf: cs.backdropFilter || cs.webkitBackdropFilter || "", color: cs.color, rad: cs.borderRadius }; }, sel);
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

// раскладка плеера: где кадр, видны ли кнопки (прозрачность и касания), переход
const look = (page) => page.evaluate(() => {
  const p = document.querySelector("[data-intro-player]");
  if (!p) return null;
  const v = p.querySelector("video[data-intro-el]"), r = v.getBoundingClientRect();
  // прозрачность — с учётом всех обёрток; переход — у обёртки, которая гаснет (у полоски — сама капсула)
  const one = (s) => { const el = p.querySelector(s); if (!el) return null; let w = el, op = 1;
    while (w && w !== p) { op *= Number(getComputedStyle(w).opacity); w = w.parentElement; }
    const b = el.getBoundingClientRect();
    return { op: Math.round(op * 100) / 100, box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
      tr: getComputedStyle(el.closest("[data-intro-controls]") || el.parentElement).transition }; };
  return { ui: p.getAttribute("data-intro-ui"), state: p.getAttribute("data-intro-state"), W: innerWidth, H: innerHeight,
    vid: { l: r.left, t: r.top, w: r.width, h: r.height }, fit: getComputedStyle(v).objectFit,
    x: one("[data-intro-x]"), mute: one("[data-intro-mute]"), toggle: one("[data-intro-toggle]"), back: one("[data-intro-back]"), next: one("[data-intro-next]"), bar: one("[data-intro-controls] [data-intro-seek]") };
});
const opac = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return -1; let w = el, op = 1; while (w && w !== document.body) { op *= Number(getComputedStyle(w).opacity); w = w.parentElement; } return Math.round(op * 100) / 100; }, sel);
const hit = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && (t === el || el.contains(t)); }, sel);
const waitUi = async (page, want, ms = 6000) => (await waitFor(page, async () => { const l = await look(page); return l && l.ui === want ? l : null; }, ms)) || look(page);

// ── FILL: видео на весь экран, вшитые титры целиком ──────────────────────────────────────────────────────────
await run(["FILL"], async () => {
  for (const [name, o, expect] of [
    ["393×852 (iPhone, Telegram на весь экран)", { width: 393, height: 852 }, "bands"],
    ["393×760 (с шапкой Telegram)", { width: 393, height: 760 }, "full"],
    ["320×640", { width: 320, height: 640 }, "bands"],
    ["852×393 (повёрнут)", { width: 852, height: 393 }, "whole"],
  ]) {
    const { ctx, page, errs } = await open({ ...o, seen: allText() });
    await lesson(page, "spg-0-1", 900);
    await page.locator("[data-intro-cover]").first().tap();
    await waitState(page, "playing");
    await page.waitForTimeout(500);
    const l = await look(page);
    const visW = Math.min(l.W, l.vid.l + l.vid.w) - Math.max(0, l.vid.l), visH = Math.min(l.H, l.vid.t + l.vid.h) - Math.max(0, l.vid.t);
    const fw = visW / l.vid.w, fh = visH / l.vid.h, band = Math.max(0, l.vid.t), side = Math.max(0, l.vid.l);
    ok("FILL " + name + ": кадр по центру", Math.abs(l.vid.l + l.vid.w / 2 - l.W / 2) < 1 && Math.abs(l.vid.t + l.vid.h / 2 - l.H / 2) < 1, l.vid);
    ok("FILL " + name + ": вшитые титры целиком — видно не меньше 90 % ширины и 92 % высоты кадра", fw >= 0.899 && fh >= 0.919, { fw, fh });
    if (expect === "full") ok("FILL " + name + ": кадр закрывает весь экран", band === 0 && side === 0 && l.vid.h >= l.H && l.vid.w >= l.W, l.vid);
    if (expect === "bands") ok("FILL " + name + ": экран закрыт по ширине, сверху и снизу полоски не больше 40 px", side === 0 && band <= 40 && l.vid.w > l.W, { band, vid: l.vid });
    if (expect === "whole") ok("FILL " + name + ": повёрнутый телефон — кадр почти целиком (обрезано не больше 8 % высоты)", fh >= 0.919 && l.vid.h <= l.H / 0.919 + 1, { fh, vid: l.vid });
    ok("FILL " + name + ": без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
});

// ── HIDE: после начала кнопки плавно гаснут, касание по видео — снова ─────────────────────────────────────────
await run(["HIDE"], async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await lesson(page, "spg-0-1", 300);
  await waitState(page, "playing");
  let l = await look(page);
  ok("HIDE: видео первым экраном — сначала кнопки на экране", !!l && l.ui === "on" && l.toggle.op === 1 && l.x.op === 1 && l.bar.op === 1, l && [l.ui, l.toggle, l.x]);
  ok("HIDE: переход плавный — прозрачность и сдвиг за 0,35 с", !!l && /opacity 0\.35s/.test(l.bar.tr) && /transform 0\.35s/.test(l.bar.tr), l && l.bar.tr);
  await page.waitForTimeout(2400);
  ok("HIDE: через 2,4 с ещё на экране (первый раз — 3,2 с: успеть увидеть «Читать текстом»)", (await look(page)).ui === "on");
  l = await waitUi(page, "off", 2500);
  ok("HIDE: потом кнопки погасли", !!l && l.ui === "off", l && l.ui);
  await page.waitForTimeout(500);
  const ops = await Promise.all(["[data-intro-x]", "[data-intro-mute]", "[data-intro-toggle]", "[data-intro-back]", "[data-intro-next]", "[data-intro-controls]"].map((s) => opac(page, s)));
  ok("HIDE: все — и сверху, и посередине, и полоска внизу — прозрачные", ops.every((x) => x === 0), ops);
  ok("HIDE: погасшие кнопки не ловят касание — касание приходится на видео", (await hit(page, "[data-intro-toggle]")) === false && (await hit(page, "[data-intro-x]")) === false);
  await shot(page, "hide-off");
  await page.locator("[data-intro-stage]").first().tap({ position: { x: 40, y: 300 } });
  await page.waitForTimeout(450);
  l = await look(page);
  ok("HIDE: касание по видео — кнопки снова на экране, ролик идёт", !!l && l.ui === "on" && l.state === "playing" && (await opac(page, "[data-intro-toggle]")) === 1, l && [l.ui, l.state]);
  await page.locator("[data-intro-stage]").first().tap({ position: { x: 40, y: 300 } });
  await page.waitForTimeout(450);
  ok("HIDE: ещё касание — гаснут сразу", (await look(page)).ui === "off");
  await page.locator("[data-intro-stage]").first().tap({ position: { x: 40, y: 300 } });
  l = await waitUi(page, "off", 4000);
  ok("HIDE: показанные касанием — гаснут сами через 2,6 с", !!l && l.ui === "off");
  // пауза — кнопки остаются
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "paused", 3000);
  await page.waitForTimeout(3600);
  ok("HIDE: на паузе кнопки не гаснут", (await look(page)).ui === "on");
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "playing", 4000);
  // пока тянут полоску — на экране
  const box = await page.locator("[data-intro-seek]").boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  for (let k = 0; k < 8; k++) { await page.mouse.move(box.x + box.width * (0.3 + 0.03 * k), box.y + box.height / 2); await page.waitForTimeout(450); }
  ok("HIDE: пока тянут полоску (3,6 с) — кнопки на экране", (await look(page)).ui === "on");
  await page.mouse.up();
  l = await waitUi(page, "off", 4000);
  ok("HIDE: отпустили — гаснут как обычно", !!l && l.ui === "off");
  // конец — кнопки на экране
  await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); v.currentTime = v.duration - 0.6; });
  const p = await waitState(page, "ended", 6000);
  await page.waitForTimeout(500);   // кнопки проявляются 0,35 с
  l = await look(page);
  ok("HIDE: в конце — на экране: «Ещё раз», «К тексту урока» посередине, полоска внизу", !!p && l.ui === "on" && !!(await page.$("[data-intro-end] [data-intro-again]")) && !(await page.$("[data-intro-toggle]")) && (await opac(page, "[data-intro-controls]")) === 1, l && l.ui);
  ok("HIDE: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
  // «уменьшить движение» в телефоне — только прозрачность, без сдвига
  const r = await open({ reduce: true });
  await lesson(r.page, "c0-1", 300);
  await waitState(r.page, "playing");
  const lr = await look(r.page);
  ok("HIDE: «уменьшить движение» — гаснут без сдвига, одной прозрачностью", !!lr && /opacity 0\.3s/.test(lr.bar.tr) && !/transform/.test(lr.bar.tr), lr && lr.bar.tr);
  const lr2 = await waitUi(r.page, "off", 5000);
  const trf = await r.page.evaluate(() => getComputedStyle(document.querySelector("[data-intro-controls]")).transform);
  ok("HIDE: «уменьшить движение» — погасшие на месте", !!lr2 && lr2.ui === "off" && (trf === "none" || trf === ""), trf);
  await r.ctx.close();
});

// ── MUTE: динамик сверху справа ───────────────────────────────────────────────────────────────────────────
await run(["MUTE"], async () => {
  const { ctx, page, errs } = await open({ seen: allText() });
  await lesson(page, "m0-1", 900);
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  const m = () => page.evaluate(() => { const b = document.querySelector("[data-intro-mute]"), v = document.querySelector("video[data-intro-el]"), r = b.getBoundingClientRect();
    return { muted: v.muted, label: b.getAttribute("aria-label"), pressed: b.getAttribute("aria-pressed"), icon: b.querySelector("[data-speaker]").getAttribute("data-speaker"),
      right: Math.round(innerWidth - r.right), top: Math.round(r.top), x: !!document.querySelector("[data-intro-x]"), xr: Math.round(document.querySelector("[data-intro-x]").getBoundingClientRect().left),
      pill: !!document.querySelector("[data-intro-sound]") }; });
  let s = await m();
  ok("MUTE: динамик — сверху справа, крестик — слева", s.right === 12 && s.xr === 12 && s.top >= 12, s);
  ok("MUTE: со звуком: «Выключить звук», значок с волнами", !s.muted && s.label === "Выключить звук" && s.pressed === "false" && s.icon === "on", s);
  await tapCtl(page, "[data-intro-mute]");
  await page.waitForTimeout(300);
  s = await m();
  ok("MUTE: касание — звук выключен, значок перечёркнут, «Включить звук»", s.muted && s.label === "Включить звук" && s.pressed === "true" && s.icon === "off", s);
  ok("MUTE: выключил сам — просьбы «Включить звук» посередине нет, ролик идёт", !s.pill && (await player(page)).state === "playing", s);
  await shot(page, "mute-off");
  const t0 = await vt(page);
  await tapCtl(page, "[data-intro-mute]");
  await page.waitForTimeout(300);
  s = await m();
  const t1 = await vt(page);
  ok("MUTE: ещё касание — звук снова, ролик дальше с того же места", !s.muted && s.icon === "on" && t1 >= t0, { s, t0, t1 });
  ok("MUTE: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
  // звук выключил телефон: динамик перечёркнут и «Включить звук»; касание динамика (пока кнопки на экране) — звук и к
  // началу звучащей фразы
  const r = await open({ play: "ios" });
  await lesson(r.page, "s0-1", 300);
  await waitState(r.page, "playing");
  await seek(r.page, 15.4);
  const tt = await vt(r.page);
  const f0 = await r.page.evaluate(() => ({ icon: document.querySelector("[data-intro-mute] [data-speaker]").getAttribute("data-speaker"), pill: !!document.querySelector("[data-intro-sound]"),
    ui: document.querySelector("[data-intro-player]").getAttribute("data-intro-ui") }));
  ok("MUTE: звук выключил телефон — динамик перечёркнут и посередине «Включить звук»", f0.icon === "off" && f0.pill, f0);
  await r.page.locator("[data-intro-mute]").first().tap();
  await r.page.waitForTimeout(400);
  const t3 = await vt(r.page);
  const f1 = await r.page.evaluate(() => ({ muted: document.querySelector("video[data-intro-el]").muted, pill: !!document.querySelector("[data-intro-sound]") }));
  ok("MUTE: касание динамика — звук, «Включить звук» ушло, ролик — с начала звучащей фразы", f0.ui === "on" && !f1.muted && !f1.pill && Math.abs(t3 - expBack(INTRO_VIDEOS["s0-1"].cues, tt, 0)) < 0.8, { f0, f1, tt, t3 });
  ok("MUTE: без ошибок страницы (iPhone)", r.errs.length === 0, r.errs);
  await r.ctx.close();
  // «Включить звук» не гаснет с кнопками; касание по видео без звука — звук (а не кнопки)
  const q = await open({ play: "ios" });
  await lesson(q.page, "c0-1", 300);
  await waitState(q.page, "playing");
  const lq = await waitUi(q.page, "off", 5000);
  ok("MUTE: «Включить звук» не гаснет вместе с кнопками", !!lq && lq.ui === "off" && (await opac(q.page, "[data-intro-sound]")) === 1);
  await q.page.locator("[data-intro-stage]").first().tap({ position: { x: 40, y: 300 } });
  await q.page.waitForTimeout(400);
  const fq = await q.page.evaluate(() => ({ muted: document.querySelector("video[data-intro-el]").muted, pill: !!document.querySelector("[data-intro-sound]"), icon: document.querySelector("[data-intro-mute] [data-speaker]").getAttribute("data-speaker") }));
  ok("MUTE: касание по видео без звука — звук включён, динамик с волнами", !fq.muted && !fq.pill && fq.icon === "on", fq);
  ok("MUTE: без ошибок страницы (iPhone, касание)", q.errs.length === 0, q.errs);
  await q.ctx.close();
});

// ── GLASS: прозрачное стекло без колец ───────────────────────────────────────────────────────────────────────
await run(["GLASS"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 3 });
  await lesson(page, "bar0-1", 900);
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  await tapCtl(page, "[data-intro-toggle]");
  await waitState(page, "paused", 3000);
  const g = await page.evaluate(() => [...document.querySelectorAll("[data-intro-player] button, [data-intro-controls]")].map((el) => { const cs = getComputedStyle(el);
    const alphas = [...cs.backgroundImage.matchAll(/rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\)/g)].map((x) => Number(x[1])); return { k: [...el.attributes].map((a) => a.name).find((n) => n.startsWith("data-intro")),
      maxA: Math.max(0, ...alphas), n: alphas.length, bf: cs.backdropFilter || cs.webkitBackdropFilter || "", gold: /232, 201, 131|214, 178, 102/.test(cs.boxShadow),
      rim: /rgba\(255, 255, 255, [\d.]+\) 0px 0px 0px 1px inset/.test(cs.boxShadow) }; }));
  ok("GLASS: колец вокруг кнопок нет", !(await page.$("[data-intro-player] [data-lens-ring]")));
  ok("GLASS: у кнопок плеера нет золотого ободка — светлая кромка, как у iPhone", g.length >= 6 && g.every((x) => !x.gold && x.rim), g);
  ok("GLASS: стекло прозрачное — заливка не плотнее 45 %", g.every((x) => x.n >= 2 && x.maxA <= 0.45), g.map((x) => [x.k, x.maxA]));
  ok("GLASS: под стеклом размытие", g.every((x) => /blur\(16px\) saturate\(1\.8\)|blur\(16px\) saturate\(180%\)/.test(x.bf)), g.map((x) => x.bf));
  const tb = await page.evaluate(() => { const t = document.querySelector("[data-intro-toggle]").getBoundingClientRect(), b = document.querySelector("[data-intro-back]").getBoundingClientRect(), n = document.querySelector("[data-intro-next]").getBoundingClientRect();
    return { t: [Math.round(t.left + t.width / 2), Math.round(t.top + t.height / 2), Math.round(t.width)], b: Math.round(b.width), n: Math.round(n.width), mid: [innerWidth / 2, innerHeight / 2], gapL: Math.round(t.left - b.right), gapR: Math.round(n.left - t.right) }; });
  ok("GLASS: посередине — ▶ 82 px ровно в центре, по бокам фразы 58 px", Math.abs(tb.t[0] - tb.mid[0]) <= 1 && Math.abs(tb.t[1] - tb.mid[1]) <= 1 && tb.t[2] === 82 && tb.b === 58 && tb.n === 58 && tb.gapL === 30 && tb.gapR === 30, tb);
  const c = await center(page, "[data-intro-toggle]");
  ok("GLASS: ▶ — по центру кружка", !!c && Math.abs(c.dx) <= 1 && Math.abs(c.dy) <= 1, c);
  await shot(page, "glass-paused");
  ok("GLASS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── COVER: обложка в уроке — как в v174, ▶ по центру ─────────────────────────────────────────────────────────
await run(["COVER"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 3 });
  await lesson(page, "spg-0-1", 1300);
  const k = await page.evaluate(() => { const bar = document.querySelector("[data-intro-bar]"), pl = bar.querySelector("[data-intro-play]"), d = bar.querySelector("[data-intro-dur]");
    const cb = getComputedStyle(bar), cp = getComputedStyle(pl), cov = document.querySelector("[data-intro-cover]").getBoundingClientRect(), r = bar.getBoundingClientRect(), pr = pl.getBoundingClientRect();
    return { barBg: cb.backgroundImage + "|" + cb.backgroundColor, barBf: cb.backdropFilter || "", playBg: cp.backgroundColor, playSh: cp.boxShadow, size: Math.round(pr.width), text: bar.innerText.replace(/\s+/g, " ").trim(),
      dur: d.textContent, l: Math.round(r.left - cov.left), b: Math.round(cov.bottom - r.bottom) }; });
  ok("COVER: нижняя строка — без стеклянной капсулы, как в v174", /none\|rgba\(0, 0, 0, 0\)/.test(k.barBg) && !/blur/.test(k.barBf), k);
  ok("COVER: ▶ — 48 px, тёмный кружок с золотой кромкой и ореолом", k.size === 48 && k.playBg === "rgba(20, 15, 8, 0.55)" && /rgba\(232, 201, 131, 0\.8\) 0px 0px 0px 1\.5px inset/.test(k.playSh) && /rgba\(232, 201, 131, 0\.12\) 0px 0px 0px 5px/.test(k.playSh), k);
  ok("COVER: «Видео-знакомство», «С чего начинается роль», 0:55", /Видео-знакомство/i.test(k.text) && /С чего начинается роль/.test(k.text) && k.dur === "0:55", k);
  ok("COVER: строка — у нижнего края, поля 14 и 13 px", k.l === 14 && k.b === 13, k);
  const c = await center(page, "[data-intro-play]");
  ok("COVER: ▶ — по центру кружка", !!c && Math.abs(c.dx) <= 1 && Math.abs(c.dy) <= 1 && c.pad === "0px", c);
  await shot(page, "cover");
  ok("COVER: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── VIDEOS: шесть новых роликов ──────────────────────────────────────────────────────────────────────────────
await run(["VIDEOS"], async () => {
  const { ctx, page, errs } = await open({ seen: allText() });
  for (const id of FIRST) {
    const v = INTRO_VIDEOS[id];
    await lesson(page, id, 1200);
    await page.locator("[data-intro-cover]").first().tap();
    await waitState(page, "playing");
    const d = await page.evaluate(() => document.querySelector("video[data-intro-el]").duration);
    const last = v.cues[v.cues.length - 1];
    ok("VIDEOS: " + id + " — длительность ролика " + d.toFixed(2) + " с, в данных " + v.dur, Math.abs(d - v.dur) < 0.6, d);
    ok("VIDEOS: " + id + " — «Начнём!» за 1–2,5 с до конца (после него пауза)", d - last > 1 && d - last < 2.5, { d, last });
    await tapCtl(page, "[data-intro-x]");
    await page.waitForTimeout(300);
  }
  ok("VIDEOS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── NARROW: 320 px ───────────────────────────────────────────────────────────────────────────────────────────
await run(["NARROW"], async () => {
  const { ctx, page, errs } = await open({ width: 320, height: 640 });
  await lesson(page, "sm0-1", 300);
  await waitState(page, "playing");
  const fit = await page.evaluate(() => { const W = innerWidth, H = innerHeight, out = [];
    for (const s of ["[data-intro-x]", "[data-intro-mute]", "[data-intro-back]", "[data-intro-toggle]", "[data-intro-next]", "[data-intro-controls]", "[data-intro-now]", "[data-intro-left]"]) {
      const el = document.querySelector(s); if (!el) { out.push(s + ": нет"); continue; } const r = el.getBoundingClientRect(); if (r.left < 0 || r.right > W + 0.5 || r.top < 0 || r.bottom > H + 0.5) out.push(s); }
    const x = document.querySelector("[data-intro-x]").getBoundingClientRect(), m = document.querySelector("[data-intro-mute]").getBoundingClientRect();
    return { out, gap: Math.round(m.left - x.right), seek: Math.round(document.querySelector("[data-intro-seek]").getBoundingClientRect().width) }; });
  ok("NARROW: на 320 px всё в экране, «Читать текстом» и динамик не сходятся, полоске хватает места", fit.out.length === 0 && fit.gap >= 40 && fit.seek >= 150, fit);
  await shot(page, "narrow");
  ok("NARROW: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── SHOTS: для владельца (393 px, ×3) ────────────────────────────────────────────────────────────────────────
await run(["SHOTS"], async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  const clean = async () => { await page.addStyleTag({ content: "#demo-strip,#demo-tgchat,#demo-push{display:none!important}" }); await page.evaluate(() => document.documentElement.style.setProperty("--sa-st", "54px")); };
  await lesson(page, "sm0-1", 300);
  await waitState(page, "playing");
  await clean();
  await seek(page, 49.7); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + "/owner-1-start.png" });
  await waitUi(page, "off", 5000); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + "/owner-2-hidden.png" });
  await tapCtl(page, "[data-intro-toggle]"); await waitState(page, "paused", 3000); await page.waitForTimeout(450);
  await page.screenshot({ path: OUT + "/owner-3-paused.png" });
  await tapCtl(page, "[data-intro-x]"); await page.waitForTimeout(800); await clean();
  await page.screenshot({ path: OUT + "/owner-4-lesson.png" });
  ok("SHOTS: снимки сделаны", true);
  ok("SHOTS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
