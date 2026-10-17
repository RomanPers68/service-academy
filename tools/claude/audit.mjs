// audit.mjs — аудит экранов: ошибки, контраст надписей, «морозное стекло» карточек.
// Запуск: PORT=5190 node audit.mjs list.json
// list.json — [{ name, who, theme, role, nav, clicks?: [selector], storage? }]
//
// Контраст меряется честно: снимок экрана делается второй раз с прозрачным
// текстом — получается ровно то, что лежит ПОД каждой надписью (стекло,
// градиент, картинка). Цвет надписи накладывается на этот фон с учётом
// прозрачности всех родителей, и считается отношение контраста по WCAG.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright");
const sharp = require(G + "/sharp");

const SITE = "/home/claude/preview/site";
const OUT = "/home/claude/audit";
const PORT = +(process.env.PORT || 5190);
mkdirSync(OUT + "/shots", { recursive: true }); mkdirSync(OUT + "/res", { recursive: true });
const list = JSON.parse(readFileSync(process.argv[2], "utf8"));
const SRC = process.env.SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));

const PROFILES = {
  staff: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false },
  admin: { id: "u-admin", name: "Роман", surname: "Петров", restaurant: "Два моря, Океан", position: "manager", is_admin: true },
};
const MISTAKES = [
  { q: "Гость говорит об аллергии на орехи. Что делаешь первым?", options: ["Советую блюдо без орехов по памяти", "Уточняю у кухни состав и отмечаю в заказе", "Предлагаю десерт", "Прошу гостя выбрать самому"], correct: 1, explanation: "Состав проверяет кухня.", lessonTitle: "Аллергены", stage: 1, due: 0 },
  { q: "Через сколько после подачи основного подходят к столу?", options: ["Сразу", "2 минуты или два укуса", "10 минут", "Когда позовут"], correct: 1, explanation: "Два укуса.", lessonTitle: "Стандарты гостеприимства", stage: 0, due: 0 },
];

// ── в странице: надписи, карточки, шрифты ──────────────────────────────────
const COLLECT = () => {
  const vw = innerWidth, vh = innerHeight;
  const opac = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none") return 0; o *= parseFloat(cs.opacity); } return o; };
  const texts = [], seen = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue;
    if (el.closest("svg, script, style, #sa-splash")) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 4 || r.height < 6 || r.bottom < 2 || r.top > vh - 2 || r.right < 2 || r.left > vw - 2) continue;
    const cs = getComputedStyle(el);
    const o = opac(el); if (o < 0.05) continue;
    seen.add(el);
    texts.push({ t: t.slice(0, 44), color: cs.color, fill: cs.webkitTextFillColor, o, fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight) || 400,
      ff: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      r: { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(vw, r.right) - Math.max(0, r.left), h: Math.min(vh, r.bottom) - Math.max(0, r.top) } });
  }
  const cards = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg, #sa-splash")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 36 || r.bottom < 0 || r.top > vh) continue;
    const cs = getComputedStyle(el);
    if ((parseFloat(cs.borderTopLeftRadius) || 0) < 10) continue;
    const bg = cs.backgroundColor, bgi = cs.backgroundImage || "none";
    const clear = /rgba\(0, 0, 0, 0\)/.test(bg) || bg === "transparent";
    if (clear && bgi === "none") continue;
    if (el.tagName === "BUTTON" || /200, 169, 110|228, 200, 140|139, 106, 48\)?\s*100%/.test(bgi) && r.height < 64) continue;   // золотые кнопки — отдельный жанр
    if (el.closest("#sa-tabbar") && el.id !== "sa-tabbar") continue;
    const sh = cs.boxShadow || "none";
    const a = bg.match(/rgba?\(([^)]+)\)/); const alpha = a ? (a[1].split(",")[3] !== undefined ? parseFloat(a[1].split(",")[3]) : 1) : 1;
    cards.push({ t: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
      inset: /inset/.test(sh), topHl: /inset 0px 1px 0px/.test(sh) || cs.borderTopColor !== cs.borderBottomColor,
      opaque: !/gradient/.test(bgi) && alpha >= 0.97, grad: /gradient/.test(bgi), y: Math.round(r.top), h: Math.round(r.height) });
  }
  const root = document.getElementById("root");
  return { texts, cards, scrollH: root ? root.scrollHeight : 0, vh };
};

const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const parseC = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map(x => parseFloat(x)); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
const EMOJI = /\p{Extended_Pictographic}/u;

const browser = await chromium.launch();
for (const sc of list) {
  const prof = PROFILES[sc.who || "staff"];
  const uk = `_${prof.name}_${prof.surname}`;
  const seed = { sa_session_token: "preview", sa_profile: JSON.stringify(prof), sa_a11y: sc.theme === "light" ? "1" : "0",
    sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify(sc.role || "seasonal"), sa_hint_mistakes: "1",
    ["sa_mistakes" + uk]: JSON.stringify(MISTAKES) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  for (const [k, v] of Object.entries(sc.storage || {})) seed[k] = typeof v === "string" ? v : JSON.stringify(v);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: "block", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await ctx.route("**/*", (route) => route.request().url().startsWith("http://localhost:" + PORT) ? route.continue() : route.abort());
  await ctx.addInitScript((seed) => { if (sessionStorage.getItem("__seeded")) return; sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/.test(m.text())) errors.push("console: " + m.text().replace(/\s+/g, " ").slice(0, 200)); });
  const res = { name: sc.name, theme: sc.theme, who: sc.who, nav: sc.nav, errors, parts: [] };
  try {
    await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
    await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
    await page.waitForTimeout(500);
    if (sc.nav) { await page.evaluate((to) => window.__saNav(to), sc.nav); await page.waitForTimeout(1500); }
    for (const c of sc.clicks || []) { await page.locator(c).first().click({ timeout: 4000 }).catch(e => errors.push("клик " + c + ": " + e.message.split("\n")[0])); await page.waitForTimeout(1300); }
    const crashed = await page.evaluate(() => /Что-то пошло не так/.test(document.body.innerText));
    if (crashed) errors.push("экран упал в «Что-то пошло не так»");
    for (let part = 0; part < 4; part++) {
      const y = part * 700;
      const sh = await page.evaluate((y) => { const r = document.getElementById("root"); if (r) r.scrollTop = y; return r ? r.scrollHeight : 0; }, y);
      if (part > 0 && y >= sh - 844 + 700) break;
      await page.waitForTimeout(350);
      const shot = join(OUT, "shots", `${sc.name}-p${part}.png`);
      await page.screenshot({ path: shot });
      const data = await page.evaluate(COLLECT);
      await page.addStyleTag({ content: "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}" }).then(h => h.evaluate(e => e.setAttribute("data-audit", "1")));
      await page.waitForTimeout(120);
      const buf = await page.screenshot();
      await page.evaluate(() => document.querySelectorAll("style[data-audit]").forEach(s => s.remove()));
      const { data: px, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      const at = (x, y) => { const i = (Math.min(info.height - 1, Math.max(0, y)) * info.width + Math.min(info.width - 1, Math.max(0, x))) * info.channels; return [px[i], px[i + 1], px[i + 2]]; };
      const low = [];
      for (const t of data.texts) {
        const c = parseC(t.fill && !/rgba\(0, 0, 0, 0\)/.test(t.fill) ? t.fill : t.color); if (!c || c[3] * t.o < 0.05) continue;
        const samp = [];
        const x0 = Math.round(t.r.x * 2), y0 = Math.round(t.r.y * 2), x1 = Math.round((t.r.x + t.r.w) * 2), y1 = Math.round((t.r.y + t.r.h) * 2);
        const sx = Math.max(1, Math.floor((x1 - x0) / 12)), sy = Math.max(1, Math.floor((y1 - y0) / 4));
        for (let yy = y0; yy < y1; yy += sy) for (let xx = x0; xx < x1; xx += sx) samp.push(at(xx, yy));
        if (!samp.length) continue;
        samp.sort((a, b) => lum(a) - lum(b));
        const bg = samp[Math.floor(samp.length / 2)];
        const a = c[3] * t.o;
        const fg = [0, 1, 2].map(i => c[i] * a + bg[i] * (1 - a));
        const cr = ratio(fg, bg);
        const large = t.fs >= 24 || (t.fs >= 18.6 && t.fw >= 700);
        if (cr < (large ? 3 : 4.5)) low.push({ t: t.t, cr: Math.round(cr * 100) / 100, fs: t.fs, fw: t.fw, color: t.color, o: Math.round(t.o * 100) / 100, bg: bg.map(Math.round), y: Math.round(t.r.y) });
      }
      const fonts = {}; for (const t of data.texts) fonts[t.ff] = (fonts[t.ff] || 0) + 1;
      const emoji = [...new Set(data.texts.filter(t => EMOJI.test(t.t)).map(t => t.t))];
      res.parts.push({ y, shot, n: data.texts.length, low, cards: data.cards, fonts, emoji });
      if (data.scrollH <= 844 + 4) break;
    }
  } catch (e) { errors.push("сбой прогона: " + e.message.split("\n")[0]); }
  writeFileSync(join(OUT, "res", sc.name + ".json"), JSON.stringify(res));
  const lows = res.parts.reduce((s, p) => s + p.low.filter(l => l.cr < 3).length, 0);
  console.log(`${sc.name}: частей ${res.parts.length}, ошибок ${errors.length}, надписей <3:1 — ${lows}`);
  await ctx.close();
}
await browser.close(); server.close();
