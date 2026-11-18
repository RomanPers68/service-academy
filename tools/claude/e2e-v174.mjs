// e2e v174 (Доп. 499): видео-знакомство в первом уроке роли. Демо целиком (tools/claude/demo-app/build.mjs), урок по id —
// window.__saLesson. Сервер ниже отдаёт ролики кусками (Range), как Vercel: без этого плеер не перематывает.
//   COVER — первый урок хостес карточками: обложка к краям карточки, кадр загрузился, ▶, «Видео-знакомство», «0:54»; ролик
//           ещё не качается; на второй карточке и во втором уроке обложки нет;
//   PLAY  — касание обложки: плеер на весь экран, ролик хостес идёт (время растёт), полоска времени растёт; касание по видео —
//           пауза и ▶ посередине; ▶ — дальше; крестик — снова урок, ролик на паузе и снят со страницы;
//   BACK  — «Назад» Telegram (первый видимый data-sa-back поверх приложения, как lib/utils.js clickScreenBack) и Escape
//           закрывают видео, урок остаётся; касания в плеере не листают карточки урока под ним;
//   END   — конец ролика: «Ещё раз» (с начала и идёт) и «К уроку»;
//   ALL   — шесть ролей: у первого урока каждой своя обложка, длительность и кадр; ролик каждой роли начинается;
//   FEED  — урок лентой: обложка сверху, над текстом;
//   LOOK  — 320 px и «Для чтения»: обложка в карточке, без прокрутки вбок; снимки для владельца (390 px, ×3).
// v175 (Доп. 500): урок с роликом, открытый с начала, показывает видео первым экраном (e2e-v175.mjs). Здесь проверяется
// обложка, как в v174, поэтому до уроков Анне ставится «выбрала текст» во всех шести. Полоска времени теперь внизу
// (data-intro-fill, ширина в %), в конце — «К тексту урока».
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v174.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5674, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v174";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const hits = [];   // какие ролики просили
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const type = mime[extname(f)] || "application/octet-stream";
  if (extname(f) === ".mp4") hits.push(p);
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
const browser = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });

// v176 (Доп. 501): ролики пересняты — длительности новые
const FIRST = { spg: ["spg-0-1", "0:55"], seasonal: ["s0-1", "0:48"], core: ["c0-1", "0:50"], manager: ["m0-1", "0:53"], service_manager: ["sm0-1", "0:55"], bar: ["bar0-1", "0:49"] };

const boot = async (page, errs, cards = true) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  await page.evaluate((c) => localStorage.setItem("sa_lesson_cards", c ? "1" : "0"), cards);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ who = "anna", light = false, cards = true, width = 390, height = 844, dsf = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs, cards);
  // v175: видео первым экраном — не здесь (e2e-v175.mjs): все шесть роликов — «выбрала текст»
  await page.evaluate(() => localStorage.setItem("sa_intro_seen_Анна_Смирнова", JSON.stringify({ "spg-0-1": "text", "s0-1": "text", "c0-1": "text", "m0-1": "text", "sm0-1": "text", "bar0-1": "text" })));
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const lesson = async (page, id, ms = 1800) => { const r = await page.evaluate((x) => (window.__saLesson ? window.__saLesson(x) : false), id); await page.waitForTimeout(ms); return r; };
const shot = async (page, n) => { await page.waitForTimeout(250); await page.screenshot({ path: OUT + "/" + n + ".png" }).catch(() => {}); };
const cover = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-intro-cover]");
  if (!el) return null;
  const r = el.getBoundingClientRect(), card = el.closest("[data-lesson-glass]"), cr = card ? card.getBoundingClientRect() : null;
  const img = el.querySelector("img"), dur = el.querySelector("[data-intro-dur]");
  return { role: el.getAttribute("data-intro-cover"), label: el.getAttribute("aria-label"), text: el.innerText.replace(/\s+/g, " ").trim(), dur: dur ? dur.textContent : "",
    left: Math.round(r.left - (cr ? cr.left : 0)), right: Math.round((cr ? cr.right : 0) - r.right), top: Math.round(r.top - (cr ? cr.top : 0)), w: Math.round(r.width), h: Math.round(r.height),
    img: img ? { src: img.getAttribute("src"), nw: img.naturalWidth, done: img.complete } : null, play: !!el.querySelector("[data-intro-play]"),
    photo: !!document.querySelector("[data-lp-cover], [data-lp-add]") };
});
const player = (page) => page.evaluate(() => {
  const p = document.querySelector("[data-intro-player]");
  if (!p) return null;
  const v = p.querySelector("video[data-intro-el]"), bar = p.querySelector("[data-intro-fill]");   // v175: полоска внизу
  const r = p.getBoundingClientRect();
  return { role: p.getAttribute("data-intro-player"), state: p.getAttribute("data-intro-state"), inBody: p.parentElement === document.body, full: r.width === innerWidth && r.height === innerHeight,
    src: v ? (v.getAttribute("data-intro-from") === "warm" ? v.getAttribute("data-intro-src") : v.currentSrc || v.src) : "",   // v177: из памяти телефона (blob:) — файл в data-intro-src
    t: v ? v.currentTime : -1, paused: v ? v.paused : null, dur: v ? v.duration : 0, inline: v ? v.hasAttribute("playsinline") : false,
    bar: bar ? bar.style.width || "" : "", x: !!p.querySelector("[data-intro-x][data-sa-back]"), resume: !!p.querySelector('[data-intro-toggle][aria-label="Смотреть"]'), end: (p.querySelector("[data-intro-end]") || {}).innerText || "" };
});
const videoLeft = (page) => page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); return v ? { inDoc: true, paused: v.paused } : { inDoc: false }; });
const waitState = async (page, want, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const p = await player(page); if (p && p.state === want) return p; await page.waitForTimeout(150); }
  return player(page);
};
const barScale = (s) => { const m = /^([\d.]+)%$/.exec(s || ""); return m ? Number(m[1]) / 100 : -1; };   // v175: ширина в %
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
    if (marked) { const what = marked.getAttribute("data-intro-x") !== null ? "video" : "screen"; marked.click(); return what; }
    const byText = [...layer.querySelectorAll('button, [role="button"]')].find((el) => isBackText(el) && visible(el));
    if (byText) { byText.click(); return "screen"; }
  }
  return "none";
});

// ── COVER ─────────────────────────────────────────────────────────────────────────────────────────────────
if (want("COVER")) {
  const { ctx, page, errs } = await open({ dsf: 3 });
  ok("COVER: урок хостес открыт", await lesson(page, "spg-0-1"));
  await page.waitForTimeout(600);
  const c = await cover(page);
  ok("COVER: обложка в первой карточке", !!c && c.role === "spg", c);
  ok("COVER: к краям стеклянной карточки (как фото урока)", !!c && Math.abs(c.left) <= 1 && Math.abs(c.right) <= 1 && Math.abs(c.top) <= 1, c);
  ok("COVER: высота 230–310 px (v175: 72vw)", !!c && c.h >= 230 && c.h <= 310, c && c.h);
  ok("COVER: кадр загрузился", !!c && c.img && c.img.done && c.img.nw === 720 && /video\/intro-spg\.jpg$/.test(c.img.src), c && c.img);
  ok("COVER: «Видео-знакомство», «С чего начинается роль», 0:55, ▶", !!c && /Видео-знакомство/i.test(c.text) && /С чего начинается роль/.test(c.text) && c.dur === "0:55" && c.play, c);
  ok("COVER: подпись для экранного диктора", !!c && c.label === "Смотреть видео-знакомство, 55 секунд", c && c.label);
  ok("COVER: фото урока на её месте не стоит", !!c && !c.photo, c);
  ok("COVER: ролик ещё не качается", hits.length === 0, hits);
  await shot(page, "cover-spg");
  await page.locator("[aria-label='Следующая карточка']").first().click();
  await page.waitForTimeout(700);
  ok("COVER: на второй карточке обложки нет", !(await cover(page)));
  await page.locator("[aria-label='Предыдущая карточка']").first().click().catch(() => {});
  await page.waitForTimeout(700);
  ok("COVER: вернулись на первую — обложка снова", !!(await cover(page)));
  ok("COVER: второй урок — без обложки", (await lesson(page, "spg-0-2")) && !(await cover(page)));
  ok("COVER: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}

// ── PLAY ──────────────────────────────────────────────────────────────────────────────────────────────────
if (want("PLAY")) {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await lesson(page, "spg-0-1");
  await page.locator("[data-intro-cover]").first().tap();
  let p = await player(page);
  ok("PLAY: плеер открылся сразу", !!p && p.role === "spg", p);
  ok("PLAY: поверх всего, в body, на весь экран", !!p && p.inBody && p.full, p);
  ok("PLAY: ролик хостес, внутри страницы (playsinline)", !!p && /video\/intro-spg\.mp4$/.test(p.src) && p.inline, p);
  p = await waitState(page, "playing");
  ok("PLAY: идёт", !!p && p.state === "playing" && !p.paused, p);
  await page.waitForTimeout(2600);
  const p2 = await player(page);
  ok("PLAY: время растёт", !!p2 && p2.t > 2, p2 && p2.t);
  ok("PLAY: полоска времени растёт", !!p2 && barScale(p2.bar) > 0.02 && barScale(p2.bar) < 0.2, p2 && p2.bar);
  ok("PLAY: крестик помечен для «Назад» Telegram", !!p2 && p2.x, p2);
  await page.waitForTimeout(900);
  await shot(page, "player-spg");
  // v176: касание по видео показывает и прячет кнопки, пауза — кнопкой посередине
  await tapCtl(page, "[data-intro-toggle]");
  const p3 = await waitState(page, "paused", 3000);
  ok("PLAY: пауза — и ▶ посередине", !!p3 && p3.state === "paused" && p3.paused && p3.resume, p3);
  await shot(page, "player-paused");
  const t3 = p3 ? p3.t : 0;
  await tapCtl(page, "[data-intro-toggle]");
  await page.waitForTimeout(1500);
  const p4 = await player(page);
  ok("PLAY: ▶ — дальше с того же места", !!p4 && p4.state === "playing" && p4.t > t3 + 0.8, { t3, p4 });
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(500);
  ok("PLAY: крестик — снова урок", !(await player(page)) && !!(await cover(page)));
  const vl = await videoLeft(page);
  ok("PLAY: ролик снят со страницы", !vl.inDoc, vl);
  await page.locator("[data-intro-cover]").first().tap();
  const p5 = await waitState(page, "playing");
  ok("PLAY: снова открыли — с начала", !!p5 && p5.state === "playing" && p5.t < 2.5, p5);
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(300);
  ok("PLAY: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}

// ── BACK ──────────────────────────────────────────────────────────────────────────────────────────────────
if (want("BACK")) {
  const { ctx, page, errs } = await open();
  await lesson(page, "spg-0-1");
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  ok("BACK: «Назад» Telegram нажимает крестик видео", (await tgBack(page)) === "video");
  await page.waitForTimeout(400);
  ok("BACK: видео закрыто, урок на месте", !(await player(page)) && !!(await cover(page)));
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("BACK: Escape — тоже только видео", !(await player(page)) && !!(await cover(page)));
  // смахивание по плееру не листает карточки урока под ним
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  const box = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  await page.evaluate(({ w, h }) => {
    const el = document.querySelector("[data-intro-stage]");
    const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: h / 2 });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(w - 40)], changedTouches: [mk(w - 40)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [mk(40)] }));
  }, box);
  await page.waitForTimeout(500);
  await tapCtl(page, "[data-intro-x]");
  await page.waitForTimeout(500);
  ok("BACK: смахнули по видео — урок на первой карточке, обложка на месте", !!(await cover(page)));
  ok("BACK: «Назад» без видео — уже экран урока", (await tgBack(page)) === "screen");
  ok("BACK: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}

// ── END ───────────────────────────────────────────────────────────────────────────────────────────────────
if (want("END")) {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await lesson(page, "spg-0-1");
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); v.currentTime = Math.max(0, v.duration - 0.8); });
  const p = await waitState(page, "ended", 6000);
  ok("END: конец ролика — «Ещё раз» и «К тексту урока» (v175)", !!p && p.state === "ended" && /Ещё раз/.test(p.end) && /К тексту урока/.test(p.end), p);
  ok("END: полоска времени — до конца", !!p && barScale(p.bar) > 0.97, p && p.bar);
  await shot(page, "player-end");
  await tapCtl(page, "[data-intro-again]");
  const p2 = await waitState(page, "playing", 5000);
  await page.waitForTimeout(600);
  const p3 = await player(page);
  ok("END: «Ещё раз» — с начала и идёт", !!p2 && !!p3 && p3.state === "playing" && p3.t < 3, p3);
  await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); v.currentTime = Math.max(0, v.duration - 0.6); });
  await waitState(page, "ended", 6000);
  await tapCtl(page, "[data-intro-done]");
  await page.waitForTimeout(500);
  ok("END: «К тексту урока» — урок, обложка на месте", !(await player(page)) && !!(await cover(page)));
  ok("END: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}

// ── ALL ───────────────────────────────────────────────────────────────────────────────────────────────────
if (want("ALL")) {
  const { ctx, page, errs } = await open();
  for (const [role, [id, dur]] of Object.entries(FIRST)) {
    ok("ALL: " + role + " — урок " + id + " открыт", await lesson(page, id, 1500));
    const c = await cover(page);
    ok("ALL: " + role + " — своя обложка, " + dur + ", кадр", !!c && c.role === role && c.dur === dur && c.img && c.img.nw === 720 && c.img.src.endsWith("intro-" + role + ".jpg"), c);
    await page.locator("[data-intro-cover]").first().tap();
    const p = await waitState(page, "playing");
    ok("ALL: " + role + " — ролик идёт", !!p && p.state === "playing" && p.src.endsWith("intro-" + role + ".mp4"), p);
    await tapCtl(page, "[data-intro-x]");
    await page.waitForTimeout(400);
    if (role === "bar") await shot(page, "cover-bar");
  }
  ok("ALL: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}

// ── FEED ──────────────────────────────────────────────────────────────────────────────────────────────────
if (want("FEED")) {
  const { ctx, page, errs } = await open({ cards: false });
  await lesson(page, "m0-1");
  const c = await cover(page);
  ok("FEED: урок лентой — обложка сверху карточки", !!c && c.role === "manager" && Math.abs(c.top) <= 1, c);
  const order = await page.evaluate(() => { const c = document.querySelector("[data-intro-cover]"), g = document.querySelector("[data-lesson-glass]");
    const txt = [...g.querySelectorAll("div")].find((d) => d.innerText && d.innerText.length > 40 && !d.contains(c) && !c.contains(d));
    return txt ? !!(c.compareDocumentPosition(txt) & Node.DOCUMENT_POSITION_FOLLOWING) : false; });
  ok("FEED: текст урока — под обложкой", order);
  await shot(page, "feed-manager");
  ok("FEED: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}

// ── LOOK ──────────────────────────────────────────────────────────────────────────────────────────────────
if (want("LOOK")) {
  for (const [name, o] of [["320", { width: 320, height: 640 }], ["light", { light: true }]]) {
    const { ctx, page, errs } = await open(o);
    await lesson(page, "c0-1");
    const c = await cover(page);
    ok("LOOK " + name + ": обложка в карточке", !!c && c.role === "core" && Math.abs(c.left) <= 1 && Math.abs(c.right) <= 1, c);
    ok("LOOK " + name + ": без прокрутки вбок", !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    const fits = await page.evaluate(() => { const el = document.querySelector("[data-intro-cover]"), d = el.querySelector("[data-intro-dur]"), r = el.getBoundingClientRect(), q = d.getBoundingClientRect();
      return q.right <= r.right && q.left >= r.left; });
    ok("LOOK " + name + ": длительность в рамке обложки", fits);
    await shot(page, "look-" + name);
    await page.locator("[data-intro-cover]").first().tap();
    const p = await waitState(page, "playing");
    ok("LOOK " + name + ": плеер на весь экран", !!p && p.full, p);
    await tapCtl(page, "[data-intro-x]");
    ok("LOOK " + name + ": без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
}

console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
