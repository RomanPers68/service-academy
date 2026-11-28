// e2e v225 (Доп. 551): общий вход для функций, опрос чата реже, когда тихо, в базе — пути к файлам. Владелец (28.11) на
// разбор «что улучшить»: «Техника 2, визуал 5 пока пропускаем, остальное делаем».
// Сайт — демо целиком (tools/claude/demo-app/build.mjs; кто вошёл — __demo_who, экран — window.__saNav). Два адреса:
//   local — http://localhost (база и функции — напрямую, как в проверках и на чужом адресе);
//   site  — https://sa-e2e.vercel.app (страницы отдаёт проверка: так приложение считает, что оно на своём сайте, и ходит
//           к базе и функциям через /sb/…; картинки по /sb/storage/… и /storage/… отдаёт тоже проверка, как Vercel).
// Разделы:
//   FN    — Наставник (local): вопрос уходит в функцию ai-chat одним запросом, напрямую; ответ на экране;
//   SITE  — на своём сайте: запросы к базе и функциям — через /sb/…; сайт не ответил (нет связи) — тот же запрос напрямую,
//           ответ на экране; Vercel не пустил (x-vercel-mitigated) — тоже напрямую; ошибка самого Vercel
//           (x-vercel-error) — второй раз не зовём: запрос мог дойти, а второй вызов AI стоил бы денег;
//   PATHS — в меню на сервере фото путём («/storage/v1/object/public/…»): у руководителя в редакторе фото видно, адрес
//           достроен (local — напрямую, site — через сайт); «В стоп» — меню уходит с путями, без полных адресов;
//   POLL  — открытая переписка: пока живо — раз в 4 с; минуту тихо — раз в 10 с; своё сообщение — снова часто;
//   COVER — обложка раздела с кадром видео-знакомства (владелец выбрал средний вариант): 250 px, глаза на 102 px, голова
//           до подбородка над строкой «Урок · шаги»; 320 и 430 px, «Для чтения»;
//   ERR   — ни одной ошибки страницы.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<снимки> node e2e-v225.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5625, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v225";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const fileOf = (p) => { let f = join(SITE, decodeURIComponent(p)); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } return f; };
const server = http.createServer((req, res) => {
  const f = fileOf(req.url.split("?")[0]);
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const LOCAL = "http://localhost:" + PORT + "/index.html";
const HOST = "https://sa-e2e.vercel.app", SITE_URL = HOST + "/index.html";
const DIRECT = "https://gvxhgdynjuaisswplroh.supabase.co";
const STORE = "/storage/v1/object/public/";
const IMG = readFileSync(join(SITE, "icons", readdirSync(join(SITE, "icons")).find((f) => /\.png$/.test(f))));
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 700) : "")); } };
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const allErrs = [];

// журнал запросов страницы (адрес, функция базы, время, тело) и поломки «своего сайта»: window.__siteFn —
// "down" (нет связи до сайта), "mitigated" (Vercel не пустил), "verr" (ошибка самого Vercel) — для функций через /sb/
const NET = `(() => { window.__net = []; const t0 = performance.now(); let cur = window.fetch;
  const wrap = (f) => function (input, init) { const u = String(typeof input === "string" ? input : (input && input.url) || "");
    const m = u.match(/\\/rpc\\/([a-z_0-9]+)/);
    const fn = (u.match(/\\/functions\\/v1\\/([a-z0-9-]+)/) || [])[1] || null;
    window.__net.push({ u, rpc: m ? m[1] : null, fn, t: Math.round(performance.now() - t0), body: m && init && typeof init.body === "string" && init.body.length < 400000 ? init.body : null });
    if (fn && u.indexOf("/sb/functions/v1/") >= 0 && window.__siteFn) {
      if (window.__siteFn === "down") return Promise.reject(new TypeError("Failed to fetch"));
      if (window.__siteFn === "mitigated") return Promise.resolve(new Response("challenge", { status: 403, headers: { "x-vercel-mitigated": "challenge" } }));
      if (window.__siteFn === "verr") return Promise.resolve(new Response("An error occurred", { status: 502, headers: { "x-vercel-error": "ROUTER_EXTERNAL_TARGET_ERROR" } }));
    }
    return f.apply(this, arguments); };
  let mine = wrap(cur);
  Object.defineProperty(window, "fetch", { configurable: true, get() { return mine; }, set(v) { cur = v; mine = wrap(v); } }); })();`;

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 30000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
}
// host: "local" — localhost; "site" — https://sa-e2e.vercel.app (страницы и картинки отдаёт проверка)
async function open({ who = "anna", host = "local", menu = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka", serviceWorkers: "block" });
  const imgs = [];
  const giveImg = (route) => { imgs.push(route.request().url()); return route.fulfill({ status: 200, contentType: "image/png", body: IMG }); };
  await ctx.route(DIRECT + STORE + "**", giveImg);
  if (host === "site") {
    await ctx.route(HOST + "/**", (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith("/sb" + STORE) || u.pathname.startsWith(STORE)) return giveImg(route);
      const f = fileOf(u.pathname);
      return route.fulfill({ status: 200, contentType: mime[extname(f)] || "application/octet-stream", body: readFileSync(f) });
    });
  }
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => { errs.push(String(e.message).slice(0, 160)); allErrs.push(who + "@" + host + ": " + String(e.message).slice(0, 160)); });
  await ctx.addInitScript(NET);
  const URL0 = host === "site" ? SITE_URL : LOCAL;
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (menu) {
    // блюда — в меню демо-сервера (как в базе после этапа 76: фото путём); копию меню на телефоне приложение возьмёт само.
    // Пишем до запуска демо (init-скрипт): открытая страница после каждого запроса сохраняет свой сервер поверх
    await page.waitForTimeout(2500);   // утренняя сверка меню (lib/tip-sync.js) прошла
    await ctx.addInitScript((add) => { try {
      const S = JSON.parse(localStorage.getItem("__demo_srv") || "null");
      if (S && Array.isArray(S.menu)) { S.menu = S.menu.filter((d) => !/^e2e/.test(String(d.id))).concat(add); localStorage.setItem("__demo_srv", JSON.stringify(S)); }
      localStorage.removeItem("sa_menu_shared");
    } catch (e) { /* */ } }, menu);
    await page.goto(URL0, { waitUntil: "load" });
    await ready(page, errs);
  }
  return { ctx, page, errs, imgs };
}
const nav = async (page, s, ms = 1600) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms); };
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
const net = (page) => page.evaluate(() => window.__net.map((x) => ({ ...x })));
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
// Наставник: вопрос в поле и кнопка отправки (последняя кнопка поля); ответ пришёл — нет точек «печатает»
const send = async (page, q) => {
  await page.fill("textarea", q); await page.waitForTimeout(150);
  await page.evaluate(() => { const t = document.querySelector("textarea"); const b = t && t.closest("[data-lens-field]") && [...t.closest("[data-lens-field]").querySelectorAll("button")].pop(); if (b) b.click(); });
};
const REPLY = /Это демо: Наставник здесь не подключён к ИИ/;
const replies = (page) => page.evaluate(() => (document.body.innerText.match(/Это демо: Наставник здесь не подключён к ИИ/g) || []).length);
const ask = async (page, q, n) => { await send(page, q); return until(async () => (await replies(page)) >= n, 15000); };

// ── FN ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("FN")) {
  const a = await open({ who: "anna" });
  await nav(a.page, "assistant", 1800);
  const n0 = (await net(a.page)).length;
  const got = await ask(a.page, "Как правильно подать хлеб к супу?", 1);
  const calls = (await net(a.page)).slice(n0).filter((x) => x.fn === "ai-chat");
  ok("FN: Наставник ответил", got && REPLY.test(await a.page.evaluate(() => document.body.innerText)));
  ok("FN: вопрос — в ai-chat одним запросом, напрямую (не свой сайт)", calls.length === 1 && calls[0].u === DIRECT + "/functions/v1/ai-chat", JSON.stringify(calls.map((c) => c.u)));
  await shot(a.page, "fn-local");
  await a.ctx.close();
}

// ── SITE ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("SITE")) {
  const a = await open({ who: "anna", host: "site" });
  const all = await net(a.page);
  const rpcs = all.filter((x) => x.rpc);
  ok("SITE: запросы к базе — через свой сайт (/sb/rest/…)", rpcs.length > 3 && rpcs.every((x) => x.u.startsWith(HOST + "/sb/rest/v1/rpc/")), JSON.stringify(rpcs.filter((x) => !x.u.startsWith(HOST + "/sb/")).map((x) => x.u).slice(0, 3)));
  await nav(a.page, "assistant", 1800);
  const fnCalls = async (from) => (await net(a.page)).slice(from).filter((x) => x.fn === "ai-chat").map((x) => x.u);
  const VIA = HOST + "/sb/functions/v1/ai-chat", DIR = DIRECT + "/functions/v1/ai-chat";
  // всё в порядке — через сайт, одним запросом
  let n0 = (await net(a.page)).length;
  let got = await ask(a.page, "Как правильно подать хлеб к супу?", 1);
  let c = await fnCalls(n0);
  ok("SITE: функция — через свой сайт, одним запросом; ответ на экране", got && c.length === 1 && c[0] === VIA, JSON.stringify(c));
  // сайт не ответил — тот же запрос напрямую
  await a.page.evaluate(() => { window.__siteFn = "down"; });
  n0 = (await net(a.page)).length;
  got = await ask(a.page, "А к салату?", 2);
  c = await fnCalls(n0);
  ok("SITE: сайт не ответил — тот же запрос напрямую, ответ на экране", got && c.length === 2 && c[0] === VIA && c[1] === DIR, JSON.stringify(c));
  // Vercel не пустил (x-vercel-mitigated) — напрямую
  await a.page.evaluate(() => { window.__siteFn = "mitigated"; });
  n0 = (await net(a.page)).length;
  got = await ask(a.page, "А к горячему?", 3);
  c = await fnCalls(n0);
  ok("SITE: Vercel не пустил (x-vercel-mitigated) — напрямую, ответ на экране", got && c.length === 2 && c[0] === VIA && c[1] === DIR, JSON.stringify(c));
  await shot(a.page, "site-fallback");
  // ошибка самого Vercel (x-vercel-error) — второй раз не зовём, экран не висит
  await a.page.evaluate(() => { window.__siteFn = "verr"; });
  n0 = (await net(a.page)).length;
  await send(a.page, "А к десерту?");
  await a.page.waitForTimeout(3500);
  c = await fnCalls(n0);
  const busy = await a.page.evaluate(() => !!document.querySelector(".sa-pulse"));
  ok("SITE: ошибка Vercel (x-vercel-error) — напрямую не повторяем, «печатает» не висит", c.length === 1 && c[0] === VIA && !busy && (await replies(a.page)) === 3, JSON.stringify({ c, busy }));
  await shot(a.page, "site-vercel-error");
  // база через сайт: после всех поломок функций запросы к базе по-прежнему идут через сайт
  await a.page.evaluate(() => { window.__siteFn = null; });
  n0 = (await net(a.page)).length;
  await nav(a.page, "menuTrainer", 2500);   // меню команды — menu_get
  const later = (await net(a.page)).slice(n0).filter((x) => x.rpc);
  ok("SITE: база — по-прежнему через сайт", later.length >= 1 && later.every((x) => x.u.startsWith(HOST + "/sb/")), JSON.stringify(later.map((x) => x.u).slice(0, 3)));
  await a.ctx.close();
}

// ── PATHS ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("PATHS")) {
  const P = STORE + "menu-photos/e2e/";
  const MENU = [1, 2, 3].map((n) => ({ id: "e2e" + n, name: "Путь " + n, cat: "Проверка", ingredients: ["вода"], img: P + n + ".png" }));
  for (const host of ["local", "site"]) {
    const m = await open({ who: "maria", host, menu: MENU });
    await nav(m.page, "menuTrainer", 2200);
    await m.page.evaluate(() => { const c = [...document.querySelectorAll(".sa-card")].find((x) => /Редактор меню/.test(x.textContent)); if (c) c.click(); });
    await m.page.waitForTimeout(1800);
    const base = host === "site" ? HOST + "/sb" : DIRECT;
    const pics = await until(async () => {
      const r = await m.page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => /\/e2e\/\d\.png/.test(i.getAttribute("src") || "")).map((i) => ({ src: i.getAttribute("src"), w: i.naturalWidth, done: i.complete })));
      return r.length >= 3 && r.every((x) => x.done) ? r : false;
    }, 9000);
    ok("PATHS " + host + ": фото путём из базы — адрес достроен (" + (host === "site" ? "через сайт" : "напрямую") + ")", !!pics && pics.every((x) => x.src.startsWith(base + P)), JSON.stringify(pics));
    ok("PATHS " + host + ": фото видно", !!pics && pics.every((x) => x.w > 0) && m.imgs.some((u) => u.startsWith(base + P)), JSON.stringify({ pics, imgs: m.imgs.slice(0, 4) }));
    await shot(m.page, "paths-" + host);
    // «В стоп» у блюда с фото — меню уходит команде: фото путём, полных адресов нет
    const n0 = (await net(m.page)).length;
    const st = await m.page.evaluate(() => {
      const card = [...document.querySelectorAll(".sa-card")].find((x) => /Путь 1/.test(x.textContent) && [...x.querySelectorAll("span")].some((s) => s.textContent.trim() === "В стоп"));
      const b = card && [...card.querySelectorAll("span")].find((s) => s.textContent.trim() === "В стоп");
      if (b) { b.scrollIntoView({ block: "center" }); b.click(); return true; }
      return false;
    });
    const sent = await until(async () => (await net(m.page)).slice(n0).find((x) => x.rpc === "menu_set" && x.body), 6000);
    let dishes = [];
    try { dishes = JSON.parse(JSON.parse(sent.body).p_dishes); } catch (e) { dishes = []; }
    const mine = dishes.filter((d) => /^e2e/.test(String(d.id)));
    ok("PATHS " + host + ": «В стоп» — меню ушло с фото путём", st && mine.length === 3 && mine.every((d) => d.img === P + d.id.slice(3) + ".png") && mine.some((d) => d.id === "e2e1" && d.stop), JSON.stringify({ st, mine: mine.map((d) => [d.id, d.img, !!d.stop]) }));
    ok("PATHS " + host + ": полных адресов хранилища в запросе нет", !!sent && !/supabase\.co\/storage|vercel\.app\/sb\/storage/.test(sent.body), sent ? sent.body.slice(0, 200) : "нет menu_set");
    await m.ctx.close();
  }
}

// ── POLL ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("POLL")) {
  const a = await open({ who: "anna" });
  await nav(a.page, "roleSelect", 1200);
  await a.page.locator("[data-chat-dock]").click(); await sleep(900);
  await a.page.locator('[data-chat-item="team"]').click();
  const tOpen = await a.page.evaluate(() => Math.round(performance.now()));
  const gaps = async (from, to) => {
    const t = (await net(a.page)).filter((x) => x.rpc === "chat_open" && x.t >= from && x.t <= to).map((x) => x.t);
    return t.slice(1).map((x, i) => x - t[i]);
  };
  const med = (g) => { const s = [...g].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  await sleep(22000);
  const g1 = await gaps(tOpen + 2000, tOpen + 22000);
  ok("POLL: открытая переписка, пока живо, — раз в 4 секунды", g1.length >= 3 && med(g1) >= 3500 && med(g1) <= 5000, JSON.stringify(g1));
  await shot(a.page, "poll-open");
  // минута без новых сообщений (отсчёт — с последнего пришедшего: демо может прислать что-то сразу после открытия)
  await sleep(74000 - 22000);
  const t2 = await a.page.evaluate(() => Math.round(performance.now()));
  await sleep(32000);
  const g2 = await gaps(t2, t2 + 32000);
  ok("POLL: минуту тихо — раз в 10 секунд", g2.length >= 2 && g2.every((x) => x >= 9500 && x <= 11500), JSON.stringify(g2));
  // своё сообщение — снова часто (ответ коллеги виден сразу)
  await a.page.locator("[data-chat-input]").fill("Проверка опроса"); await sleep(300);
  await a.page.locator("[data-chat-send]").click();
  const t3 = await a.page.evaluate(() => Math.round(performance.now()));
  await sleep(9000);
  const g3 = await gaps(t3, t3 + 9000);
  ok("POLL: своё сообщение — снова часто (раз в 1,5 с)", g3.length >= 3 && med(g3) <= 2600, JSON.stringify(g3));
  const sent = await a.page.evaluate(() => /Проверка опроса/.test(document.body.innerText));
  ok("POLL: сообщение в переписке", sent);
  await a.ctx.close();
}

// ── COVER ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("COVER")) {
  // где на обложке макушка, глаза и подбородок (доли кадра — data/intro-videos.js, сезонный: 0,07 · 0,3 · 0,5)
  const measure = (page) => page.evaluate(() => {
    const m = document.querySelector(".tbp-cur .tbm-menu[data-mod-cover='video']") || document.querySelector(".tbm-menu[data-mod-cover='video']");
    if (!m) return null;
    const c = m.querySelector(".tbm-cover"), img = c && c.querySelector("img"), eb = m.querySelector(".tbm-eyebrow");
    if (!img || !img.naturalWidth) return { noimg: true };
    const cr = c.getBoundingClientRect(), W = cr.width, H = cr.height, nh = W * img.naturalHeight / img.naturalWidth;
    const off = (nh - H) * parseFloat(getComputedStyle(img).objectPosition.split(" ")[1]) / 100;
    const at = (f) => Math.round(f * nh - off);
    const shade = getComputedStyle(c, "::after").backgroundImage;
    return { W: Math.round(W), H: Math.round(H), top: at(0.07), eyes: at(0.3), chin: at(0.5), eb: Math.round(eb.getBoundingClientRect().top - cr.top), shade,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  for (const [width, light] of [[390, false], [320, false], [430, false], [390, true]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka", serviceWorkers: "block" });
    const page = await ctx.newPage();
    const errs = []; page.on("pageerror", (e) => { errs.push(String(e.message)); allErrs.push("cover: " + e.message); });
    await page.goto(LOCAL, { waitUntil: "load" });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("__demo_who", "anna"); });
    await page.goto(LOCAL, { waitUntil: "load" }); await ready(page, errs);
    if (light) { await page.getByText("Для чтения").first().click(); await page.waitForTimeout(900); }
    await nav(page, "home", 2200);
    const r = await until(async () => { const x = await measure(page); return x && !x.noimg ? x : false; }, 8000);
    const tag = "COVER " + width + (light ? " светлая" : "");
    if (width === 390 && !light) {
      ok(tag + ": обложка 250 px, глаза на 102 px (±4)", !!r && r.H === 250 && Math.abs(r.eyes - 102) <= 4, JSON.stringify(r));
      ok(tag + ": голова до подбородка над строкой «Урок · шаги», макушка срезана не больше чем на 50 px", !!r && r.chin <= r.eb - 8 && r.top >= -50, JSON.stringify(r));
      ok(tag + ": затемнение начинается ниже лица", !!r && /rgba\(22, 17, 9, 0\) 0%, rgba\(22, 17, 9, 0\.05\) 60%/.test(r.shade), r && r.shade);
    } else if (light) {
      ok(tag + ": затемнение светлое, тоже ниже лица", !!r && /rgba\(248, 241, 226, 0\) 0%, rgba\(248, 241, 226, 0\.05\) 60%/.test(r.shade), r && r.shade);
    } else {
      ok(tag + ": подбородок над строкой «Урок · шаги» (на широком — у самой строки, под затемнением)", !!r && r.chin <= r.eb + (width > 400 ? 10 : -8) && r.H === 250, JSON.stringify(r));
    }
    ok(tag + ": вбок не сдвигается", !!r && r.over <= 1, r && r.over);
    await shot(page, "cover-" + width + (light ? "-light" : ""));
    await ctx.close();
  }
}

if (want("ERR")) ok("ERR: ошибок страницы нет", allErrs.length === 0, allErrs.join(" | "));
console.log("\n" + pass + " из " + (pass + fail) + " проверок прошли");
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
