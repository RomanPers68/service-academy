// e2e v224 (Доп. 550): бесшовная загрузка и три правки вида. Владелец (28.11): «Когда заходишь в приложение по закреплённой
// ссылке на главном экране (на iPhone), то многие фото да и всё остальное грузит очень долго, а должно быть бесшовно».
// Сайт — демо целиком (tools/claude/demo-app/build.mjs; кто вошёл — __demo_who, экран — window.__saNav). Разделы:
//   MENU   — «Меню»: служебная строка «Блюд в базе… сборка» у официанта не видна, у менеджера — есть, со сборкой v224;
//   STEP   — карточка текущего шага: «≈ 3 мин · 8 ситуаций» не режется посреди слова (390 и 320 px);
//   STRIP  — номера тем: касание — подпись темы сразу (без долгого нажатия), палец повёл вбок — подпись следующей,
//            отпустил — открылась та тема; палец пошёл вверх — подписи нет, тема прежняя;
//   STAFF  — превью кружков всей команды приезжают заранее: на медленной сети «Команда» и «Смена» открываются уже с фото;
//   AHEAD  — фото меню из хранилища — заранее, по три сразу, отметки в sa_photo_ahead_v1; второй запуск их не качает;
//   NB     — «Первая неделя» на медленной сети не мелькает: прошлый ответ newbie_me — с телефона сразу;
//   ERR    — ни одной ошибки страницы.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<снимки> node e2e-v224.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5624, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v224";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 600) : "")); } };
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const allErrs = [];

// медленная сеть: выбранные функции базы (или все, если список пуст) отвечают через d мс
// add — блюда, которые меню команды (menu_get) отдаст сверх своих (AHEAD: фото из хранилища)
const SLOW = (names, d, add = []) => `(() => { const N = ${JSON.stringify(names)}, D = ${d}, ADD = ${JSON.stringify(add)}; window.__rpcLog = []; const t0 = performance.now(); let cur = window.fetch;
  const wrap = (f) => function (input, init) { const u = String(typeof input === "string" ? input : (input && input.url) || "");
    const m = u.match(/\\/rpc\\/([a-z_0-9]+)/); const name = m ? m[1] : null;
    if (name) window.__rpcLog.push([name, Math.round(performance.now() - t0)]);
    if (name === "menu_get" && ADD.length) return f.apply(this, arguments).then(async (r) => { const j = await r.clone().json().catch(() => null);
      return Array.isArray(j) ? new Response(JSON.stringify(j.concat(ADD)), { status: r.status, headers: { "Content-Type": "application/json" } }) : r; });
    if (!name || !window.__slow || (N.length && !N.includes(name))) return f.apply(this, arguments);
    const self = this, args = arguments; return new Promise((r) => setTimeout(r, D)).then(() => f.apply(self, args)); };
  let mine = wrap(cur);
  Object.defineProperty(window, "fetch", { configurable: true, get() { return mine; }, set(v) { cur = v; mine = wrap(v); } }); })();`;

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 30000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
}
async function open({ who = "anna", width = 390, height = 844, slow = null, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => { errs.push(String(e.message).slice(0, 160)); allErrs.push(who + ": " + String(e.message).slice(0, 160)); });
  await ctx.addInitScript(SLOW(slow ? slow.names : [], slow ? slow.d : 0));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, s]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); for (const [k, v] of Object.entries(s || {})) localStorage.setItem(k, v); }, [who, seed]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  return { ctx, page, errs };
}
const nav = async (page, s, ms = 1600) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(200); };
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });

// ── MENU ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("MENU")) {
  const a = await open({ who: "anna" });
  await nav(a.page, "menuTrainer");
  const annaLine = await a.page.evaluate(() => ({ svc: !!document.querySelector("[data-menu-service]"), text: /Блюд в базе|сборка v\d+/.test(document.body.innerText) }));
  ok("MENU: официант — служебной строки нет", !annaLine.svc && !annaLine.text, JSON.stringify(annaLine));
  await shot(a.page, "menu-anna");
  await a.ctx.close();
  const m = await open({ who: "maria" });
  await nav(m.page, "menuTrainer");
  const mLine = await m.page.evaluate(() => { const e = document.querySelector("[data-menu-service]"); return e ? e.textContent : ""; });
  // v225: сборка — не ниже v224 (номер растёт с каждой версией)
  ok("MENU: менеджер — строка есть, со сборкой (v224 и новее)", /Блюд в базе: \d+/.test(mLine) && Number((/сборка v(\d+)/.exec(mLine) || [])[1]) >= 224, mLine);
  await shot(m.page, "menu-maria");
  await m.ctx.close();
}

// ── STEP ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("STEP")) {
  for (const width of [390, 320]) {
    const a = await open({ who: "anna", width });
    await nav(a.page, "home", 1800);
    const info = await a.page.evaluate(() => {
      const ck = document.querySelector(".tbp-cur .tbm-cur .tbm-ck") || document.querySelector(".tbm-cur .tbm-ck");
      if (!ck) return null;
      const t = ck.querySelector(".tbm-ckt");
      const box = ck.getBoundingClientRect();
      const parts = t ? [...t.querySelectorAll(":scope > span")].map((s) => { const b = s.getBoundingClientRect(); return { text: s.textContent, right: Math.round(b.right), w: Math.round(b.width), sw: s.scrollWidth }; }) : [];
      return { has: !!t, text: ck.textContent, right: Math.round(box.right), over: ck.scrollWidth - ck.clientWidth, parts };
    });
    ok("STEP " + width + ": подпись шага — частями, ничего не режется", !!info && info.has && info.over <= 1 && info.parts.every((p) => p.right <= info.right + 1), JSON.stringify(info));
    if (width === 390) ok("STEP: «≈ … мин · N ситуаций» целиком", !!info && /≈ \d+ мин · \d+ ситуаци/.test(info.text), info && info.text);
    await a.page.evaluate(() => { const c = document.querySelector(".tbp-cur .tbm-cur") || document.querySelector(".tbm-cur"); if (c) c.scrollIntoView({ block: "center" }); });
    await a.page.waitForTimeout(300);
    await shot(a.page, "step-" + width);
    await a.ctx.close();
  }
}

// ── STRIP ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("STRIP")) {
  const a = await open({ who: "anna" });
  await nav(a.page, "home", 1800);
  const cdp = await a.ctx.newCDPSession(a.page);
  const numAt = (i) => a.page.evaluate((k) => { const row = document.querySelector(".tbp-strip .tbp-nums"); const b = row && row.querySelector('.tbp-num[data-i="' + k + '"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, fits: row.scrollWidth <= row.clientWidth + 1, n: row.querySelectorAll(".tbp-num").length }; }, i);
  const touch = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: p.x, y: p.y }] });
  const cur = () => a.page.evaluate(() => { const b = document.querySelector('.tbp-strip .tbp-nums .tbp-num[aria-selected="true"]'); return b ? Number(b.getAttribute("data-i")) : -1; });
  const peekText = () => a.page.evaluate(() => { const p = document.querySelector(".tbp-strip .tbp-peek"); return p ? p.textContent : ""; });
  const titles = await a.page.evaluate(() => [...document.querySelectorAll(".tbp-strip .tbp-nums .tbp-num")].map((b) => b.getAttribute("aria-label") || ""));
  const p3 = await numAt(3), p5 = await numAt(5);
  ok("STRIP: номера помещаются в ряд", !!p3 && p3.fits && p3.n >= 6, JSON.stringify(p3));
  const before = await cur();
  await touch("touchStart", p3);
  await a.page.waitForTimeout(90);
  const t1 = await peekText();
  ok("STRIP: касание — подпись темы сразу (90 мс, без долгого нажатия)", t1.length > 3 && titles[3] && titles[3].includes(t1.split(" · ").slice(1).join(" · ").trim().slice(0, 12)), t1 + " | " + titles[3]);
  await touch("touchMove", { x: (p3.x + p5.x) / 2, y: p3.y });
  await touch("touchMove", p5);
  await a.page.waitForTimeout(90);
  const t2 = await peekText();
  ok("STRIP: палец повёл вбок — подпись следующей темы", t2 && t2 !== t1 && titles[5].includes(t2.split(" · ").slice(1).join(" · ").trim().slice(0, 12)), t2 + " | " + titles[5]);
  await touch("touchEnd", p5);
  await a.page.waitForTimeout(900);
  ok("STRIP: отпустил — открылась та тема", (await cur()) === 5, "было " + before + ", стало " + (await cur()));
  ok("STRIP: подпись убрана", !(await peekText()));
  await shot(a.page, "strip-after");
  // палец пошёл вверх — это прокрутка: подпись уходит, тема та же
  const q = await numAt(2);
  await touch("touchStart", q);
  await a.page.waitForTimeout(60);
  await touch("touchMove", { x: q.x + 1, y: q.y + 30 });
  await a.page.waitForTimeout(60);
  const gone = !(await peekText());
  await touch("touchEnd", { x: q.x + 1, y: q.y + 30 });
  await a.page.waitForTimeout(700);
  ok("STRIP: палец вверх-вниз — подписи нет и тема прежняя", gone && (await cur()) === 5, "peek gone " + gone + ", cur " + (await cur()));
  await a.ctx.close();
}

// ── STAFF ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("STAFF")) {
  const a = await open({ who: "anna" });
  await a.page.waitForTimeout(4500);   // на главной, никуда не переходим
  const log = await a.page.evaluate(() => window.__rpcLog.map((x) => x[0]));
  ok("STAFF: превью команды взяты заранее (staff_photo с главной)", log.includes("staff_photo"), log.join(","));
  // медленная сеть: всё из базы — через 1,5 с
  await a.page.evaluate(() => { window.__slow = true; });
  await a.page.evaluate(() => window.__saNav && window.__saNav("teamHub"));
  await a.page.waitForTimeout(450);
  const team = await a.page.evaluate(() => { const box = [...document.querySelectorAll("*")].find((e) => /Лидеры ресторана/.test(e.textContent || "") && e.querySelectorAll("img").length && e.children.length < 12); return box ? box.querySelectorAll("img").length : 0; });
  ok("STAFF: «Команда» на медленной сети — сразу с фото", team >= 2, "фото: " + team);
  await shot(a.page, "staff-team-early");
  await a.page.evaluate(() => window.__saNav && window.__saNav("shift"));
  await a.page.waitForTimeout(450);
  const shift = await a.page.evaluate(() => { const c = [...document.querySelectorAll("*")].find((e) => /с тобой сегодня/.test(e.textContent || "") && e.children.length < 10); return c ? c.querySelectorAll("img").length : -1; });
  ok("STAFF: «Смена» на медленной сети — кружки с фото", shift >= 1, "фото: " + shift);
  await shot(a.page, "staff-shift-early");
  await a.ctx.close();
}

// ── AHEAD ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("AHEAD")) {
  const IMG = readFileSync(join(SITE, "icons", (await import("node:fs")).readdirSync(join(SITE, "icons")).find((f) => /\.png$/.test(f))));
  // хост не supabase.co: такие адреса демо отвечает «нет» само (boot.js), а этот уходит в сеть, где его ловит проверка
  const B = "https://photos.e2e/storage/v1/object/public/menu-photos/e2e/";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Kamchatka" });
  const hits = [];
  let live = 0, peak = 0;
  await ctx.route(B + "**", async (route) => { live++; peak = Math.max(peak, live); hits.push(route.request().url()); await sleep(300); live--; await route.fulfill({ status: 200, contentType: "image/png", body: IMG }); });
  // меню команды отдаёт ещё 9 блюд: 7 с фото в хранилище, повтор одного фото и фото прямо в записи (data:)
  const ADD = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: "e2e" + n, name: "Блюдо " + n, img: B + n + ".png" }))
    .concat([{ id: "e2e8", name: "Повтор", img: B + "1.png" }, { id: "e2e9", name: "Без фото", img: "data:image/png;base64,AAA" }]);
  await ctx.addInitScript(SLOW([], 0, ADD));
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => { errs.push(String(e.message)); allErrs.push("ahead: " + e.message); });
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("__demo_who", "anna"); });
  await page.goto(URL0, { waitUntil: "load" }); await ready(page, errs);
  await page.waitForTimeout(3000);   // утренняя сверка меню (lib/tip-sync.js) прошла, отметка дня стоит
  // те же блюда — в меню демо-сервера и в копию меню на телефоне; перезапуск
  await page.evaluate((add) => {
    const S = JSON.parse(localStorage.getItem("__demo_srv") || "{}"); if (Array.isArray(S.menu)) { S.menu = S.menu.filter((d) => !/^e2e/.test(String(d.id))).concat(add); localStorage.setItem("__demo_srv", JSON.stringify(S)); }
    const r = JSON.parse(localStorage.getItem("sa_profile")).restaurant;
    const sh = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}") || {}; sh[r] = (Array.isArray(sh[r]) ? sh[r] : []).filter((d) => !/^e2e/.test(String(d.id))).concat(add);
    localStorage.setItem("sa_menu_shared", JSON.stringify(sh));
  }, ADD);
  await page.goto(URL0, { waitUntil: "load" }); await ready(page, errs);
  const inCache = await page.evaluate(() => { const sh = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); return Object.values(sh).flat().filter((d) => d && /\/e2e\//.test(d.img || "")).length; });
  ok("AHEAD: меню команды с фото из хранилища на телефоне", inCache >= 7, inCache);
  await page.waitForTimeout(7000 + 3 * 300 * 3 + 1500);
  const marks = await page.evaluate(() => JSON.parse(localStorage.getItem("sa_photo_ahead_v1") || "{}"));
  const mine = Object.keys(marks).filter((u) => u.includes("/e2e/"));
  ok("AHEAD: фото меню из хранилища взяты заранее, каждое один раз", new Set(hits).size === 7 && hits.length === 7, hits.length + " запросов, " + new Set(hits).size + " адресов");
  ok("AHEAD: не больше трёх сразу", peak <= 3 && peak >= 2, "сразу: " + peak);
  ok("AHEAD: отметки на телефоне", mine.length === 7, mine.length);
  hits.length = 0;
  await page.goto(URL0, { waitUntil: "load" }); await ready(page, errs);
  await page.waitForTimeout(7000 + 1500);
  ok("AHEAD: второй запуск — заранее не качает", hits.length === 0, hits.length);
  await ctx.close();
}

// ── NB ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("NB")) {
  const a = await open({ who: "anna", slow: { names: ["newbie_me"], d: 2500 } });
  await nav(a.page, "shift", 3600);   // первый раз — ответ сервера (сеть ещё быстрая) ложится на телефон
  const fin = await a.page.evaluate(() => !!document.querySelector("[data-nb-hero]"));
  const saved = await a.page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("sa_nb_me_")));
  ok("NB: ответ newbie_me лежит на телефоне", saved);
  await a.page.evaluate(() => { window.__slow = true; });
  await a.page.reload({ waitUntil: "load" }); await ready(a.page, a.errs);
  await a.page.evaluate(() => { window.__slow = true; });
  await a.page.evaluate(() => window.__saNav && window.__saNav("shift"));
  await a.page.waitForTimeout(400);
  const early = await a.page.evaluate(() => !!document.querySelector("[data-nb-hero]"));
  await a.page.waitForTimeout(3500);
  const late = await a.page.evaluate(() => !!document.querySelector("[data-nb-hero]"));
  ok("NB: «Первая неделя» на медленной сети не мелькает", early === late && late === fin, "сразу " + early + ", потом " + late + ", как было " + fin);
  await a.ctx.close();
}

if (want("ERR")) ok("ERR: ошибок страницы нет", allErrs.length === 0, allErrs.join(" | "));
console.log("\n" + pass + " из " + (pass + fail) + " проверок прошли");
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
