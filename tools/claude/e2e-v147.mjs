// e2e v147 (Доп. 470): кнопки снова линзы — золотом только «Начать» на главной. Сайт — демо целиком
// (tools/claude/demo-app/build.mjs: сервер в странице, люди демо).
// Разделы: CRAWL (Анна, Мария, Роман — все экраны приложения по очереди: ни одной золотой кнопки, кнопки-линзы
// по пути есть), LIGHT (Мария, «Для чтения»: те же экраны — без золота), HOME («Начать» — линза с подсветкой и одним кольцом, корешок 84 px — Доп. 471),
// SCHEDULE (Мария, «График» → «Ещё»: «Заполнить черновик», «Картинкой команде», «Сообщить в чат команды» — линзы, без
// внешнего кольца), LESSON (Анна, урок «Концепция и история» до конца: «Закрепить у стола» — линза).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v147.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5347, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v147";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 400) : "")); } };
const browser = await chromium.launch();
const SCREENS = ["roleSelect", "home", "about", "analytics", "assistant", "barLab", "barPrint", "brief", "candidate", "cases", "cellar", "certificate", "certificates",
  "checklist", "ckEditor", "cocktails", "contentEditor", "daily", "exam", "gain", "glossary", "guestbook", "guide", "leaderboard", "league", "lesson", "mastery", "me",
  "mentor", "menuTrainer", "mistakes", "module", "morning", "newbie", "newbies", "onboarding", "peerThanks", "playerDetail", "profile", "reference", "report",
  "roleComplete", "schedule", "search", "seat", "server", "shift", "sos", "stats", "team", "teamHub", "thanks", "trainingCard", "weeklyGuest", "wineEditor", "wines"];

async function open({ who = "anna", light = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1600);
  // значки и «Утро руководителя» в Telegram — закрываются сами, чтобы не загораживать экраны
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  return { ctx, page, errs };
}
const nav = async (page, s, ms = 1300) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms); };
// золото v146: заливка linear-gradient(172deg, #F1DBA4 … | #EFD69C …) и тёмная надпись #24180A
const scan = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('[data-lens-btn="main"], .tb-main')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const gold = els.filter((el) => { const cs = getComputedStyle(el); return /linear-gradient\(172deg/.test(cs.backgroundImage) || cs.color === "rgb(36, 24, 10)"; });
  return { all: els.length, gold: gold.map((el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40)) };
});
const lensOf = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src);
  const el = [...document.querySelectorAll('[data-lens-btn="main"], .tb-main')].find((e) => rx.test(e.innerText || "") && e.getBoundingClientRect().width > 0);
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { t: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40), bg: cs.backgroundImage.slice(0, 40), c: cs.color, after: getComputedStyle(el, "::after").display };
}, re.source);

// ── CRAWL ─────────────────────────────────────────────────────────────────────────────────────────────────
if (want("CRAWL")) {
  for (const who of ["anna", "maria", "roman"]) {
    const { ctx, page, errs } = await open({ who });
    let seen = 0; const bad = [];
    for (const sc of SCREENS) {
      await nav(page, sc);
      const r = await scan(page);
      seen += r.all;
      if (r.gold.length) bad.push(sc + ": " + r.gold.join(" | "));
    }
    ok(`CRAWL ${who}: все экраны — ни одной золотой кнопки`, bad.length === 0, bad.join(" ; "));
    ok(`CRAWL ${who}: кнопки-линзы по пути есть (${seen})`, seen > 5, String(seen));
    ok(`CRAWL ${who}: без ошибок страницы`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
}

// ── LIGHT ─────────────────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page } = await open({ who: "maria", light: true });
  const bad = []; let seen = 0;
  for (const sc of ["roleSelect", "schedule", "brief", "mastery", "cocktails", "about", "candidate", "barPrint", "gain", "contentEditor", "ckEditor"]) {
    await nav(page, sc);
    const r = await scan(page); seen += r.all;
    if (r.gold.length) bad.push(sc + ": " + r.gold.join(" | "));
  }
  ok("LIGHT: «Для чтения» — ни одной золотой кнопки", bad.length === 0 && seen > 5, bad.join(" ; ") + " / " + seen);
  await ctx.close();
}

// ── HOME ──────────────────────────────────────────────────────────────────────────────────────────────────
if (want("HOME")) {
  const { ctx, page } = await open({ who: "anna" });
  await nav(page, "roleSelect", 1200);
  const st = await page.evaluate(() => {
    const s = document.querySelector("[data-now-stub]"), l = s && s.querySelector("[data-now-lens]"), c = s && s.querySelector("[data-now-cta]"), ring = l && l.querySelector(":scope > span");
    const r = s && s.getBoundingClientRect(), lr = l && l.getBoundingClientRect();
    return s ? { bg: getComputedStyle(s).backgroundImage.slice(0, 40), w: Math.round(r.width), lens: lr ? Math.round(lr.width) : 0, lensSh: l ? getComputedStyle(l).boxShadow.slice(0, 60) : "",
      ring: ring ? getComputedStyle(ring).display : "", cta: c ? getComputedStyle(c).color : "" } : null; });
  ok("HOME: «Начать» — линза с подсветкой: корешок 84 px (+ поля 4 px — 92) со свечением, линза 50 px, второе кольцо скрыто, надпись золотом",
    !!st && /^radial-gradient/.test(st.bg) && st.w === 92 && st.lens === 50 && st.ring === "none" && st.cta === "rgb(232, 201, 131)", JSON.stringify(st));
  await page.screenshot({ path: join(OUT, "home.png") });
  await ctx.close();
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────────────────────────────────────
if (want("SCHEDULE")) {
  const { ctx, page } = await open({ who: "maria" });
  await nav(page, "schedule", 2200);
  const more = page.locator("button:has-text('Ещё'), [role=button]:has-text('Ещё')").first();
  if (await more.count()) { await more.click().catch(() => {}); await page.waitForTimeout(900); }
  const found = [];
  for (const re of [/Заполнить/, /Картинкой команде/, /Сообщить в чат команды/]) {
    const b = await lensOf(page, re);
    if (b) found.push(b);
  }
  ok("SCHEDULE: кнопки «Графика» нашлись (Заполнить / Картинкой команде / Сообщить в чат команды)", found.length >= 2, JSON.stringify(found));
  ok("SCHEDULE: все — линзы (стекло, золотая надпись), без внешнего кольца",
    found.length > 0 && found.every((b) => /^radial-gradient/.test(b.bg) && b.c === "rgb(232, 201, 131)" && b.after === "none"), JSON.stringify(found));
  const r = await scan(page);
  ok("SCHEDULE: на экране ни одной золотой кнопки", r.gold.length === 0, r.gold.join(" | "));
  await page.screenshot({ path: join(OUT, "schedule.png") });
  await ctx.close();
}

// ── LESSON ────────────────────────────────────────────────────────────────────────────────────────────────
if (want("LESSON")) {
  const { ctx, page } = await open({ who: "anna" });
  await nav(page, "roleSelect", 1200);
  await page.locator("[data-track-chip=seasonal]").click(); await page.waitForTimeout(900);
  await page.locator("[data-track-go]").click(); await page.waitForTimeout(1500);
  await page.locator("button:has-text('Начать'), [role=button]:has-text('Начать')").first().click(); await page.waitForTimeout(2200);
  let b = null;
  for (let i = 0; i < 14 && !b; i++) {
    b = await lensOf(page, /Закрепить у стола/);
    if (!b) { await page.locator("[aria-label='Следующая карточка']").first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(700); }
  }
  ok("LESSON: конец урока — «Закрепить у стола» есть", !!b, "кнопка не нашлась");
  ok("LESSON: «Закрепить у стола» — линза, без внешнего кольца", !!b && /^radial-gradient/.test(b.bg) && b.after === "none", JSON.stringify(b));
  const r = await scan(page);
  ok("LESSON: на экране урока ни одной золотой кнопки", r.gold.length === 0, r.gold.join(" | "));
  await page.screenshot({ path: join(OUT, "lesson-end.png") });
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
