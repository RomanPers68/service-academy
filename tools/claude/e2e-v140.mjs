// e2e v140 (Доп. 455): новые уроки по таблице обучения холдинга. Владелец (05.11): «Продолжим» — после «О нас»: курс по
// алкоголю (вино, крепкое, пиво) для «Ядра» и «Менеджера» и конфликты в коллективе для бара и хостес. Всё — новыми уроками в
// конце треков, существующее не меняется. Сервер — демо в памяти (fake-server.js), уроки — из data/modules-*.js.
// Разделы: CORE (трек «Ядро»: «Урок 6 · Алкоголь: вино, крепкое, пиво» последним; урок «Вино: стиль за десять секунд» —
// термин «Танины» из глоссария; урок про пиво — новый термин «Лагер» с определением; практика ситуаций), QUIZ (тест урока —
// 12 вопросов из банка в 20), SEARCH (поиск «пробков» находит урок про подачу), MANAGER («Урок 6 · Алкоголь в заведении»: закон — штрафы
// на осень 2026 года и цифровой ID в Max), BAR («Урок 6 · Конфликты: гость у стойки и команда», «Сборка: спор на раздаче»
// с видом «выдача»), SPG («Урок 10 · Хостес и команда», живой диалог «Опять ко мне?» с официантом: верный путь — Денис
// доволен; худший — «Денис ушёл к менеджеру»), LIGHT (светлая тема: урок и сборка без ошибок).
// v140 (Доп. 456): LOAD — полоска загрузки Telegram на iPhone: до события load приложение ничего не запрашивает (см. раздел).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v140.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5340, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v140";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { DIALOGUES_DATA } = await import(SRC + "/data/dialogues.js");
const { GLOSSARY } = await import(SRC + "/data/glossary.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const TZ = "Asia/Kamchatka";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const R0 = "Два моря, Океан";
const P = (id, name, surname, position, x = {}) => ({ id, name, surname, restaurant: R0, position, is_admin: false, ...x });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter"), PETR = P("e-petr", "Пётр", "Орлов", "waiter");
const OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ROMAN = P("u-roman", "Роман", "", "owner", { is_admin: true });
const PEOPLE = [MARIA, ANNA, PETR, OLGA, ROMAN];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 3, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 4, name: "Ли Ольга", pos: "host", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 } }, split: {}, rules: { peakDows: [], highDows: [] }, staff: SSTAFF };
const plan = () => { const o = {}; for (let i = -3; i <= 20; i++) for (const sid of [1, 2, 3, 4]) if ((i + sid) % 3) (o[sid] = o[sid] || {})[i] = "Д"; return o; };
const srvOf = () => {
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: plan(), menu: [], tgLinked: [], push: () => {} });
  s.calls = [];
  return s;
};

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IPHONE = (v) => "Mozilla/5.0 (iPhone; CPU iPhone OS " + v + " like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/" + v.replace("_", ".") + " Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";

// экран «Домой» (navigator.standalone), Telegram с вырезом снизу (safeAreaInset), сервис-воркер для касания уведомления
// (window.__swGo: приложение открывает переписку, как по уведомлению; так её проще всего открыть)
const INIT = (cfg) => {
  const et = new EventTarget();
  const reg = { active: {}, pushManager: { getSubscription: async () => null, subscribe: async () => { throw new Error("нет"); } } };
  const sw = { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg), controller: null,
    addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a), dispatchEvent: (e) => et.dispatchEvent(e) };
  Object.defineProperty(Navigator.prototype, "serviceWorker", { get: () => sw, configurable: true });
  window.__swGo = (go) => sw.dispatchEvent(new MessageEvent("message", { data: { type: "sa-go", go } }));
  if (cfg.standalone) {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode: standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q));
    Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true });
  }
  if (cfg.tg) {
    window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", version: "9.0", initDataUnsafe: {}, ready() {}, expand() {},
      setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {}, onEvent() {}, offEvent() {}, isVersionAtLeast: () => false, isFullscreen: false,
      safeAreaInset: { top: 0, bottom: cfg.tg.bottom || 0, left: 0, right: 0 }, contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
      openTelegramLink() {}, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } };
  }
};

async function open({ who = ANNA, srv, w = 393, h = 852, scr, ua = IPHONE("18_6"), cfg = {}, go = "", light = false, role = "seasonal" }) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, screen: scr || { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce", userAgent: ua, colorScheme: light ? "light" : "dark" });
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      srv.calls.push({ fn: m[1], body });
      const own = srv.rpc(m[1], body);
      return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own === undefined ? null : own) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify(role), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_boot_missing: String(Date.now()), sa_hub_open: "all" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  await ctx.addInitScript(INIT, cfg);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + "/" + (go ? "?go=" + go : ""), { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await sleep(900);
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };

const nav = async (page, s, ms = 1400) => { await page.evaluate((x) => window.__saNav && window.__saNav(x), s); await sleep(ms); };
const txt = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const body = (page) => txt(page.locator("body"));
// урок трека: главная → номер темы (по названию) → шаг в меню темы (как в e2e-v37)
async function toLesson(page, topic, lesson) {
  await nav(page, "home", 1500);
  await page.locator('.tbp-num[aria-label*="' + topic + '"]').first().click({ timeout: 6000 });
  await sleep(900);
  await page.locator(".tbm-node:not(.tbp-side *)", { hasText: lesson }).first().click({ timeout: 6000 });
  await sleep(1300);
}
// читать урок лентой: весь текст сразу (карточки — только у первого входа)
const feed = (page) => page.evaluate(() => { const b = document.querySelector('[aria-label="Читать лентой"]'); if (b) b.click(); });
const topics = (page) => page.evaluate(() => [...document.querySelectorAll(".tbp-num")].map((e) => e.getAttribute("aria-label") || ""));
const dotted = (page, term) => page.evaluate((term) => [...document.querySelectorAll("span")].some((s) => s.textContent.trim().toLowerCase() === term.toLowerCase()
  && getComputedStyle(s).borderBottomStyle === "dotted"), term);
const dlgId = (page) => page.evaluate(() => { const d = document.querySelector(".sa-dlg[data-dlg]"); return d ? d.getAttribute("data-dlg") : null; });
async function playDialogue(page, how) {
  const id = await dlgId(page);
  const D = DIALOGUES_DATA.find((d) => d.id === id);
  if (!D) return { id, err: "сценарий не найден: " + id };
  await page.evaluate(() => { window.__tap = setInterval(() => { const c = document.querySelector(".dc-chat"); if (c) c.click(); }, 120); });
  for (let n = 0; n < 40; n++) {
    await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 25000 });
    if (await page.locator("[data-dlg-next]").count()) break;
    await sleep(150);
    const idx = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
    const o = how(D.steps[idx]);
    const texts = await page.evaluate(() => [...document.querySelectorAll("[data-dlg-reply] .dc-opt-t")].map((e) => e.textContent));
    await page.locator(`[data-dlg-reply="${texts.indexOf(o.text)}"]`).click();
  }
  await page.waitForSelector("[data-dlg-next]", { timeout: 25000 });
  await page.evaluate(() => clearInterval(window.__tap));
  await sleep(700);
  return { id, ...(await page.evaluate(() => {
    const rv = document.querySelector("[data-dlg-review]");
    return { review: rv ? rv.getAttribute("data-dlg-review") : null, title: rv ? (rv.querySelector(".dc-rv-t") || {}).textContent : null, walk: !!document.querySelector("[data-dlg-msg=walk]") };
  })) };
}
const right = (step) => step.options.find((o) => o.correct);
const worst = (step) => step.options.filter((o) => !o.correct).sort((a, b) => (Number(a.moodDelta) || 0) - (Number(b.moodDelta) || 0))[0];

await run("CORE", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv, role: "core" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  ok("CORE: трек «Ядро» — семь тем, последняя «Алкоголь: вино, крепкое, пиво»", tp.length === 7 && /Алкоголь: вино, крепкое, пиво/.test(tp[6]), JSON.stringify(tp.slice(-2)));
  await shot(o.page, "core-track");
  await toLesson(o.page, "Алкоголь: вино, крепкое, пиво", "Вино: стиль за десять секунд");
  await feed(o.page); await sleep(700);
  const t = await body(o.page);
  ok("CORE: урок «Вино: стиль за десять секунд» — пять осей стиля, формула «три слова», «Барная карта»", /Пять осей стиля/.test(t) && /Формула «три слова»/.test(t) && /«Барной карте»/.test(t), t.slice(0, 200));
  ok("CORE: термин «Танины» подсвечен (глоссарий)", await dotted(o.page, "Танины"));
  await shot(o.page, "core-wine");
  await toLesson(o.page, "Алкоголь: вино, крепкое, пиво", "Пиво: стили, температура, пена");
  await feed(o.page); await sleep(700);
  ok("CORE: урок про пиво — «Лагер» подсвечен (новый термин)", await dotted(o.page, "Лагер"));
  await o.page.evaluate(() => { const s = [...document.querySelectorAll("span")].find((x) => x.textContent.trim() === "Лагер" && getComputedStyle(x).borderBottomStyle === "dotted"); if (s) s.click(); });
  await sleep(600);
  const lag = GLOSSARY.find((g) => g.term === "Лагер");
  ok("CORE: касание «Лагер» — определение из глоссария", !!lag && (await body(o.page)).includes(lag.def.slice(0, 40)));
  await shot(o.page, "core-beer-term");
  await toLesson(o.page, "Алкоголь: вино, крепкое, пиво", "Практика ситуаций");
  ok("CORE: практика ситуаций открылась", /Посоветуйте белое|Красное вино подают|эль отличается|крепкое, но мягкое|младше 25|креветками|Острое блюдо|до краёв/.test(await body(o.page)), (await body(o.page)).slice(0, 200));
  const [e1, e2] = noErr(o); ok("CORE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("QUIZ", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv, role: "core" });
  await toLesson(o.page, "Алкоголь: вино, крепкое, пиво", "Тест: алкоголь — вино, крепкое, пиво");
  const t = await body(o.page);
  ok("QUIZ: тест урока — 12 вопросов из банка в 20 («Вопрос 1 из 12», зачёт от 10)", /Тест · 12 вопросов/.test(t) && /Вопрос 1 из 12/.test(t), t.slice(0, 200));
  await shot(o.page, "core-quiz");
  const [e1, e2] = noErr(o); ok("QUIZ: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SEARCH", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv, role: "core" });
  await nav(o.page, "search", 1200);
  await o.page.locator("input").first().fill("пробков"); await sleep(900);
  const card = o.page.locator(".sa-card").filter({ hasText: "Подача: температура, бокал, игристое" });
  ok("SEARCH: «пробков» — урок «Подача: температура, бокал, игристое» из «Алкоголь: вино, крепкое, пиво»", (await card.count()) >= 1 && /Алкоголь: вино, крепкое, пиво/.test(await txt(card.first())));
  const [e1, e2] = noErr(o); ok("SEARCH: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("MANAGER", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv, role: "manager" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  // v141: дальше восьмая тема «Урок 7 · Админ на смене», поэтому «Алкоголь в заведении» — седьмая, но уже не последняя
  ok("MANAGER: трек «Менеджер» — седьмая тема «Алкоголь в заведении: продукт, деньги, закон»", tp.length >= 7 && /Алкоголь в заведении/.test(tp[6]), JSON.stringify(tp.slice(6)));
  await toLesson(o.page, "Алкоголь в заведении", "Закон: возраст, документы, ответственность");
  await feed(o.page); await sleep(700);
  const t = await body(o.page);
  ok("MANAGER: урок «Закон» — штрафы на осень 2026 года, цифровой ID в Max, «моложе 25»", /от 300 до 500 тысяч/.test(t) && /Max/.test(t) && /моложе 25/.test(t), t.slice(0, 200));
  await shot(o.page, "manager-law");
  await toLesson(o.page, "Алкоголь в заведении", "Деньги в напитках: порция, потери, списания");
  await feed(o.page); await sleep(500);
  ok("MANAGER: урок «Деньги в напитках» — расчёт порции", /порция 50 мл — 100 ₽/.test(await body(o.page)));
  const [e1, e2] = noErr(o); ok("MANAGER: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("BAR", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  // v142: дальше восьмая тема «Урок 7 · Приём и хранение», поэтому «Конфликты» — седьмая, но уже не последняя
  ok("BAR: трек «Бар» — седьмая тема «Конфликты: гость у стойки и команда»", tp.length >= 7 && /Конфликты: гость у стойки и команда/.test(tp[6]), JSON.stringify(tp.slice(6)));
  await toLesson(o.page, "Конфликты: гость у стойки и команда", "Бар и зал: очередь, ошибки, стоп-лист");
  await feed(o.page); await sleep(500);
  ok("BAR: урок «Бар и зал» — «Горит» по договорённости, стоп-лист в чат смены", /«Горит»/.test(await body(o.page)) && /в чат смены/.test(await body(o.page)));
  await toLesson(o.page, "Конфликты: гость у стойки и команда", "Сборка: спор на раздаче");
  const t = await body(o.page);
  ok("BAR: «Сборка: спор на раздаче» — вид «выдача» и первый шаг", /Спор на раздаче/.test(t) && /ВЫДАЧА/.test(t) && /Где мой мохито|важные гости|апероль вместо негрони|Закончился лайм|Пик прошёл/.test(t), t.slice(0, 240));
  await shot(o.page, "bar-build");
  const [e1, e2] = noErr(o); ok("BAR: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SPG", async () => {
  const srv = srvOf();
  const o = await open({ who: OLGA, srv, role: "spg" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  ok("SPG: трек «Хостес» — одиннадцать тем, последняя «Хостес и команда: конфликты внутри»", tp.length === 11 && /Хостес и команда: конфликты внутри/.test(tp[10]), JSON.stringify(tp.slice(-1)));
  await toLesson(o.page, "Хостес и команда", "Рассадка и официанты");
  await feed(o.page); await sleep(500);
  ok("SPG: урок «Рассадка и официанты» — «Смена» → «Рассадка», «Я-сообщение» в глоссарии", /«Рассадке»/.test(await body(o.page)) && !!GLOSSARY.find((g) => g.term === "Я-сообщение"));
  await toLesson(o.page, "Хостес и команда", "Живой диалог");
  await o.page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  ok("SPG: живой диалог — сценарий «Опять ко мне?» (spg-b10-1)", (await dlgId(o.page)) === "spg-b10-1");
  await shot(o.page, "spg-dialog");
  const good = await playDialogue(o.page, right);
  ok("SPG: верный путь — Денис доволен (настроение 5)", good.review === "5" && !good.walk, JSON.stringify(good));
  await shot(o.page, "spg-dialog-end");
  await o.ctx.close();
  const o2 = await open({ who: OLGA, srv, role: "spg" });
  await toLesson(o2.page, "Хостес и команда", "Живой диалог");
  await o2.page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  const bad = await playDialogue(o2.page, worst);
  ok("SPG: худший путь — «Денис ушёл к менеджеру»", bad.walk && /Денис ушёл к менеджеру/.test(bad.title || ""), JSON.stringify(bad));
  const [e1, e2] = noErr(o2); ok("SPG: без ошибок", e1, e2);
  await o2.ctx.close();
});

await run("LIGHT", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv, role: "manager", light: true });
  await toLesson(o.page, "Алкоголь в заведении", "Карта напитков под контролем");
  ok("LIGHT: урок в светлой теме", /Что менеджер проверяет до открытия/.test(await body(o.page)));
  await shot(o.page, "light-lesson");
  const [e1, e2] = noErr(o); ok("LIGHT: без ошибок", e1, e2);
  await o.ctx.close();
});

// LOAD (Доп. 456), владелец (06.11): «В телеграмме появилась какая-то полоса снизу» — полоска загрузки самого Telegram на iPhone:
// видна, пока WebKit не закончил загрузку страницы, а WebKit ждёт каждый запрос, начатый до события load (fetch тоже). Здесь —
// Chromium с Telegram на iPhone (без сервис-воркера): (1) обычный запуск — до load от приложения ни одного запроса, сервер и уроки
// роли — после; (2) load задержан картинкой на 1,5 с — приложение ждёт его и показывается после; (3) load задержан на 6 с —
// приложение стартует по страховке через 3 с.
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
async function openLoad(slow, srv) {
  const who = ANNA, UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block",
    locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce", userAgent: IPHONE("18_6"), colorScheme: "dark" });
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN + "/__slow.png")) { await sleep(slow); return route.fulfill({ status: 200, contentType: "image/png", body: PNG1 }).catch(() => {}); }
    if (u.startsWith(ORIGIN)) return route.continue().catch(() => {});
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      srv.calls.push({ fn: m[1], body });
      const own = srv.rpc(m[1], body);
      return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own === undefined ? null : own) }).catch(() => {});
    }
    return route.abort().catch(() => {});
  });
  const seed = { sa_a11y: "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("core"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_boot_missing: String(Date.now()), sa_hub_open: "all" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  await ctx.addInitScript(INIT, { tg: { bottom: 34 } });
  await ctx.addInitScript((slow) => {
    window.__ld = { load: null, fetch1: null, shown: null };
    addEventListener("load", () => { window.__ld.load = performance.now(); });
    const of = window.fetch;
    window.fetch = function (...a) { if (window.__ld.fetch1 == null) window.__ld.fetch1 = performance.now(); return of.apply(this, a); };
    document.addEventListener("DOMContentLoaded", () => {
      if (slow) { const i = new Image(); i.src = "/__slow.png"; i.alt = ""; i.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none"; document.body.appendChild(i); }
      const mo = new MutationObserver(() => { if (window.__ld.shown == null && !document.getElementById("sa-splash")) { window.__ld.shown = performance.now(); mo.disconnect(); } });
      mo.observe(document.body, { childList: true, subtree: true });
    });
  }, slow);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  page.goto(ORIGIN + "/", { timeout: 30000 }).catch(() => {});
  return { ctx, page, errors };
}
const ldState = (page) => page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0], dcl = nav ? nav.domContentLoadedEventStart : 0, ld = window.__ld.load == null ? Infinity : window.__ld.load;
  const res = performance.getEntriesByType("resource");
  // что приложение запросило до load (кроме самой страницы, её скриптов и шрифта заставки): в WebKit это держит полоску Telegram
  const pre = res.filter((e) => e.startTime < ld && !(e.initiatorType === "script" && e.startTime < dcl) && !/\/assets\/fonts\/pt-serif-latin-400-normal|__slow/.test(e.name))
    .map((e) => e.initiatorType + " " + e.name.replace(location.origin, "").slice(0, 80));
  const role = res.filter((e) => /modules-core/.test(e.name)).map((e) => e.startTime);
  return { ...window.__ld, pre, role: role.length ? Math.min(...role) : null };
});
const ms = (x) => (x == null ? "нет" : Math.round(x));

await run("LOAD", async () => {
  const srv = srvOf();
  const o = await openLoad(0, srv);
  await until(() => o.page.evaluate(() => window.__ld && window.__ld.shown != null), 15000);
  await sleep(1500);
  const s = await ldState(o.page);
  ok("LOAD: обычный запуск — приложение показано, главная с треком", s.shown != null && /Ядро|Урок/.test(await body(o.page)), JSON.stringify({ shown: ms(s.shown), load: ms(s.load) }));
  ok("LOAD: до load от приложения — ни одного запроса (полоска Telegram уходит сразу)", s.load != null && s.pre.length === 0, s.pre.slice(0, 6).join(" | "));
  ok("LOAD: первый запрос к серверу и уроки роли — после load", s.fetch1 != null && s.fetch1 >= s.load && s.role != null && s.role >= s.load,
    JSON.stringify({ load: ms(s.load), fetch1: ms(s.fetch1), role: ms(s.role) }));
  ok("LOAD: сервер ответил, как обычно (whoami)", srv.calls.some((c) => c.fn === "whoami"));
  const [e1, e2] = noErr(o); ok("LOAD: обычный запуск без ошибок", e1, e2);
  await o.ctx.close();

  const srv2 = srvOf();
  const o2 = await openLoad(1500, srv2);
  await until(() => o2.page.evaluate(() => window.__ld && window.__ld.shown != null), 15000);
  await sleep(800);
  const s2 = await ldState(o2.page);
  ok("LOAD: load задержан на 1,5 с — приложение ждёт его и показывается после", s2.load != null && s2.load >= 1400 && s2.shown != null && s2.shown >= s2.load,
    JSON.stringify({ load: ms(s2.load), shown: ms(s2.shown) }));
  ok("LOAD: и тогда до load от приложения — ни одного запроса", s2.pre.length === 0 && s2.fetch1 != null && s2.fetch1 >= s2.load, s2.pre.slice(0, 6).join(" | ") + " fetch1=" + ms(s2.fetch1));
  const [e3, e4] = noErr(o2); ok("LOAD: задержка 1,5 с без ошибок", e3, e4);
  await o2.ctx.close();

  const srv3 = srvOf();
  const o3 = await openLoad(6000, srv3);
  await until(() => o3.page.evaluate(() => window.__ld && window.__ld.shown != null), 9000);
  const s3 = await ldState(o3.page);
  ok("LOAD: load задержан на 6 с — старт по страховке через 3 с, не дожидаясь", s3.shown != null && s3.shown >= 2900 && s3.shown < 5500 && s3.load == null,
    JSON.stringify({ shown: ms(s3.shown), load: ms(s3.load) }));
  await shot(o3.page, "load-fallback");
  const [e5, e6] = noErr(o3); ok("LOAD: страховка без ошибок", e5, e6);
  await o3.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
