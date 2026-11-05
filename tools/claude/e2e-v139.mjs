// e2e v139 (Доп. 454): «О нас» — концепция и стандарты сети и заведения. Владелец (05.11): «можно оставить редактор, чтобы
// каждое заведение могло вписать свою концепцию, а руководитель сети общую»; «да. Я про дресс-код, фото и т.д.»; «чтобы это
// было дополнением к имеющемуся. И чтобы все функции приложения с этим взаимодействовали». Сервер — демо в памяти
// (fake-server.js, этап 49), пример — tools/claude/demo-app/concept-seed.js (сеть, «Два моря, Океан», сосед «Порт», два фото).
// Разделы: ABOUT (Анна: «Команда» → «О нас» с «новое», блоки своего трека, фото, сосед, «Прочитал(а)»), TRACK (раздел
// «Наш ресторан» первым в треке, урок с фото, тест из вопросов блоков), SEARCH (сосед по сети в поиске, касание — «О нас»),
// ASSIST (Наставнику уходят выдержки из «О нас», кнопка «О нас»), EDIT (Мария, менеджер: «Концепция и стандарты» —
// только своё заведение, новый блок, «Сообщить команде» — бот Анне, «Кто прочитал»), NET (Роман: «Вся сеть», свой блок,
// другое заведение), GO (?go=about), NOSTAGE (без этапа 49: у сотрудника пункта нет, руководителю — «Нужен этап 49»),
// LIGHT (светлая тема: экран и редактор без ошибок). Владелец (05.11): «Добавленное все имеет эффект линзы?» — в EDIT и NET
// каждая кнопка, поле и плитка экранов «О нас» с меткой data-lens-* (вкладки — капсулой, выбранная — плашкой); «И в демо
// только 2 заведения, в финальном будут все?» — в NET выбор заведения: все заведения сети из data/roles.js, пустое — правится.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v139.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5339, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v139";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { CONCEPT_SEED, CONCEPT_PHOTOS } = await import(SRC + "/tools/claude/demo-app/concept-seed.js");
const { RESTAURANTS } = await import(SRC + "/data/roles.js");
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
// v139: «О нас» — пример из демо (сеть, «Два моря, Океан», сосед «Порт», два фото); pings — что написал бот
const srvOf = (x = {}) => {
  const pings = [];
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: plan(), menu: [], tgLinked: ["u-maria", "e-anna", "e-petr", "u-roman"],
    progress: { "e-anna": ["s0-1", "s0-2"] }, ping: (to, text, acts, chat, msg, o) => pings.push({ to, text, o }), push: () => {},
    concept: x.empty ? null : CONCEPT_SEED, conceptPhotos: x.empty ? null : CONCEPT_PHOTOS, noStage49: !!x.noStage49 });
  s.calls = []; s.pings = pings;
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

async function open({ who = ANNA, srv, w = 393, h = 852, scr, ua = IPHONE("18_6"), cfg = {}, go = "", light = false }) {
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
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
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
const openGroups = (page) => page.evaluate(() => document.querySelectorAll('[data-hub-toggle][aria-expanded="false"]').forEach((b) => b.click()));
const hubItem = (page, label) => page.locator(`[aria-label="${label}"]`).first();
// v139: «эффект линзы» — видимые кнопки, поля и плитки экрана без метки data-lens-*. Не в счёт: строка соседа (внутри
// карточки-линзы), фото (картинка), зелёный кружок верного ответа (как в редакторе уроков), галочки «Из документа»,
// невыбранная вкладка в капсуле (линзу даёт капсула data-lens-seg, как у «График / Настройки»)
const lensMiss = (page) => page.evaluate(() => [...document.querySelectorAll(".sa-screen button, .sa-screen input, .sa-screen textarea, .sa-screen select, .sa-screen label")]
  .filter((e) => e.getClientRects().length && e.type !== "checkbox" && e.type !== "file" && !(e.tagName === "LABEL" && !e.querySelector("input[type=file]")))
  .filter((e) => !e.closest("[data-cn-photo]") && !e.closest("[data-cn-docblock]") && !e.matches("[data-cn-other] > button, [data-cn-right], [data-lens-seg] > button"))
  .filter((e) => ![...e.attributes].some((a) => a.name.startsWith("data-lens")))
  .map((e) => (e.getAttribute("aria-label") || e.innerText || e.tagName).trim().slice(0, 24)));
const lensOn = (page) => page.evaluate(() => document.documentElement.classList.contains("sa-lens"));
const scrollAll = (page, y = 99999) => page.evaluate((v) => { const r = document.getElementById("root"); if (r) r.scrollTop = v; window.scrollTo(0, v); }, y);

await run("ABOUT", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv });
  await nav(o.page, "teamHub", 1600); await openGroups(o.page); await sleep(500);
  const item = hubItem(o.page, "О нас");
  ok("ABOUT: в «Команде» пункт «О нас» с отметкой «новое»", (await item.count()) === 1 && /новое/.test(await txt(item)), await txt(item));
  await shot(o.page, "about-hub");
  await item.click(); await sleep(1600);
  const t = await body(o.page);
  ok("ABOUT: экран «О нас»: «Вся сеть», «Два моря, Океан», «Соседи по сети»", o.page.url() && (await o.page.locator('[data-about="ready"]').count()) === 1 && /Вся сеть/.test(t) && /Два моря, Океан/.test(t) && /Соседи по сети/.test(t), t.slice(0, 300));
  ok("ABOUT: блоки сети и заведения по порядку; распорядок дня менеджера официанту не виден",
    (await o.page.locator("[data-cn-block]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cn-block")).join(","))) === "idea,values,structure,dress,idea,pitch,setting,check" && !/Распорядок дня менеджера/.test(t),
    await o.page.locator("[data-cn-block]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cn-block")).join(",")));
  ok("ABOUT: фото дресс-кода и сервировки загрузились (превью с сервера)", !!(await until(() => o.page.evaluate(() => [...document.querySelectorAll("[data-cn-photo] img")].filter((i) => i.complete && i.naturalWidth > 0).length === 2), 8000)));
  const missA = await lensMiss(o.page);
  ok("ABOUT: «Линза» — карточки блоков и кнопки с метками", (await lensOn(o.page)) && !missA.length && (await o.page.locator("[data-cn-block][data-lens-card]").count()) === 8, JSON.stringify(missA));
  await o.page.locator("[data-cn-photo] button").first().click(); await sleep(900);
  ok("ABOUT: касание фото — целиком, с подписью; «Закрыть»", (await o.page.locator("[data-cn-viewer] img").count()) === 1 && /Форма зала/.test(await txt(o.page.locator("[data-cn-viewer]"))));
  await shot(o.page, "about-photo");
  await o.page.locator("[data-cn-viewer] button").click(); await sleep(400);
  await o.page.locator('[data-cn-other="Порт"] button').click(); await sleep(500);
  const port = await txt(o.page.locator('[data-cn-other="Порт"]'));
  ok("ABOUT: сосед «Порт» — концепция и рассказ гостю, без внутренних стандартов", /Концепция «Порта»/.test(port) && /Рассказ гостю/.test(port) && !/Форма/.test(port), port.slice(0, 200));
  await scrollAll(o.page); await sleep(400);
  await shot(o.page, "about-bottom");
  await o.page.locator("[data-cn-read]").click();
  ok("ABOUT: «Прочитал(а)» — отмечено, кнопки больше нет", !!(await until(() => o.page.locator("[data-cn-readok]").count(), 5000)) && (await o.page.locator("[data-cn-read]").count()) === 0);
  const g = srv.rpc("concept_get", { p_token: tok(ANNA) });
  ok("ABOUT: на сервере прочитаны обе части", g.read.net === g.net.ver && g.read.venue === g.venue.ver, JSON.stringify(g.read));
  await nav(o.page, "teamHub", 1200); await openGroups(o.page); await sleep(400);
  ok("ABOUT: в «Команде» отметки «новое» больше нет", !/новое/.test(await txt(hubItem(o.page, "О нас"))));
  const [e1, e2] = noErr(o); ok("ABOUT: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("TRACK", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv });
  await nav(o.page, "home", 1800);
  const first = await o.page.evaluate(() => { const t = document.body.innerText; const i = t.indexOf("Наш ресторан"), j = t.indexOf("Психология первого дня"); return { i, j }; });
  ok("TRACK: «Наш ресторан» — первым разделом трека (раньше «Психологии первого дня»)", first.i >= 0 && (first.j < 0 || first.i < first.j), JSON.stringify(first));
  await shot(o.page, "track-first");
  const r = srv.rpc("concept_get", { p_token: tok(ANNA) });
  ok("TRACK: сервер отдаёт пример (сеть 4 блока, заведение 5)", r.net.blocks.length === 4 && r.venue.blocks.length === 5, JSON.stringify([r.net.blocks.length, r.venue.blocks.length]));
  // открыть урок дресс-кода через поиск по урокам
  await nav(o.page, "search", 1200);
  await o.page.locator("input").first().fill("Бейдж слева"); await sleep(900);
  const les = o.page.locator(".sa-card").filter({ hasText: "Внешний вид и дресс-код" }).first();
  ok("TRACK: поиск находит урок «Внешний вид и дресс-код» из раздела «Наш ресторан»", (await les.count()) === 1);
  await les.click(); await sleep(1800);
  ok("TRACK: в уроке — фото формы (из «О нас»)", !!(await until(() => o.page.locator("[data-lesson-photos] [data-cn-photo] img").count(), 6000)));
  await shot(o.page, "track-lesson-photo");
  const mods = srv.rpc("concept_get", { p_token: tok(ANNA) });
  ok("TRACK: тест раздела — вопросы блоков (бейдж, украшения, аквариум, бокал, чек)", mods.net.blocks.concat(mods.venue.blocks).reduce((a, b) => a + (b.questions || []).length, 0) === 6);
  const [e1, e2] = noErr(o); ok("TRACK: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SEARCH", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv });
  await nav(o.page, "search", 1200);
  await o.page.locator("input").first().fill("причал"); await sleep(900);
  const r = o.page.locator("[data-search-about]");
  ok("SEARCH: «причал» — «Соседи по сети»: «Порт»", (await r.count()) >= 1 && /Порт/.test(await txt(r.first())), await txt(r.first()));
  await shot(o.page, "search-about");
  await r.first().click(); await sleep(1500);
  ok("SEARCH: касание — экран «О нас»", (await o.page.locator('[data-about]').count()) === 1);
  const [e1, e2] = noErr(o); ok("SEARCH: без ошибок", e1, e2);
  await o.ctx.close();
});

const SEND_AI = '.sa-layer button:has(path[d="M22 2L11 13"])';
await run("ASSIST", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv });
  const calls = [];
  await o.ctx.route("**/functions/v1/ai-chat", async (route) => {
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    calls.push(b);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: "«Порт»: бар у причала, крафтовое пиво и живая музыка по пятницам.\n[[go:about|О нас]]", remaining: 10 }) });
  });
  await nav(o.page, "assistant", 1600);
  await o.page.locator(".sa-layer textarea").fill("Какая концепция у «Порта»?"); await o.page.locator(SEND_AI).click();
  await until(() => calls.length, 8000); await sleep(1200);
  const sent = calls.length ? String(calls[calls.length - 1].messages.slice(-1)[0].content) : "";
  ok("ASSIST: Наставнику — выдержки из «О нас» (сосед «Порт»), кнопка [[go:about|О нас]], не длиннее 2000",
    sent.startsWith("Какая концепция у «Порта»?") && sent.includes("[О нас, концепция и стандарты заведений сети: ") && sent.includes("(Порт)") && sent.includes("[[go:about|О нас]]") && sent.length <= 2000, sent.slice(-500));
  const btn = o.page.locator(".sa-layer button, .sa-layer [role=button]").filter({ hasText: "О нас" });
  ok("ASSIST: под ответом — кнопка «О нас»", (await btn.count()) >= 1);
  await shot(o.page, "assist");
  await btn.last().click(); await sleep(1500);
  ok("ASSIST: касание — экран «О нас»", (await o.page.locator("[data-about]").count()) === 1);
  const [e1, e2] = noErr(o); ok("ASSIST: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("EDIT", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv });
  await nav(o.page, "teamHub", 1600); await openGroups(o.page); await sleep(500);
  const item = hubItem(o.page, "Концепция и стандарты");
  ok("EDIT: у менеджера в «Управлении» — «Концепция и стандарты»", (await item.count()) === 1);
  await item.click(); await sleep(1600);
  ok("EDIT: сразу правка своего заведения; вкладки «Вся сеть» нет, выбора заведения нет",
    (await o.page.locator('[data-about="edit"][data-cn-scope="venue"]').count()) === 1 && (await o.page.locator('[data-cn-tab="net"]').count()) === 0 && (await o.page.locator("[data-cn-rest]").count()) === 0);
  ok("EDIT: блоки «Океана» с «для кого»: распорядок — менеджерам", /Распорядок дня менеджера для кого: Менеджер, Сервис-менеджер/.test(await body(o.page)));
  const miss0 = await lensMiss(o.page);
  ok("EDIT: «Линза» — список блоков: у всех кнопок и полей метки линзы (↑↓, «Править», «Удалить», «Добавить блок», «Из документа»)", (await lensOn(o.page)) && !miss0.length, JSON.stringify(miss0));
  await shot(o.page, "edit-list");
  await o.page.locator("[data-cn-add]").click(); await sleep(500);
  ok("EDIT: выбор вида — 13 видов; «Концепция» уже есть", (await o.page.locator("[data-cn-kind]").count()) === 13 && /Уже есть/.test(await txt(o.page.locator('[data-cn-kind="idea"]'))));
  const miss1 = await lensMiss(o.page);
  ok("EDIT: «Линза» — виды блока стеклом (data-lens-opt), «Отмена» — стекло", (await o.page.locator('[data-cn-kind][data-lens-opt=""]').count()) === 13 && !miss1.length, JSON.stringify(miss1));
  await shot(o.page, "edit-kinds");
  await o.page.locator('[data-cn-kind="mood"]').click(); await sleep(600);
  ok("EDIT: новый блок «Атмосфера», «для кого» — все", (await o.page.locator('[data-cn-kind-edit="mood"]').count()) === 1 && (await o.page.locator("[data-cn-title]").inputValue()) === "Атмосфера" && (await o.page.locator("[data-cn-tracks]").getAttribute("data-cn-tracks")) === "");
  await o.page.locator("[data-cn-body]").fill("");
  await o.page.locator("[data-cn-save]").click(); await sleep(500);
  ok("EDIT: пустой текст — «Нужен текст или фото»", /Нужен текст или фото/.test(await txt(o.page.locator("[data-cn-err]"))));
  await o.page.locator("[data-cn-body]").fill("Тёплый свет и тихий джаз до 21:00.\n• Свечи на столах после 19:00");
  await o.page.locator('[data-cn-track="manager"]').click();
  await o.page.locator('[data-cn-track="seasonal"]').click();
  await o.page.locator("[data-cn-qadd]").click(); await sleep(300);
  await o.page.locator("[data-cn-q] textarea").fill("Когда зажигаем свечи?");
  const opts = o.page.locator("[data-cn-q] input[placeholder^='Вариант']");
  await opts.nth(0).fill("С открытия"); await opts.nth(1).fill("После 19:00");
  await o.page.locator("[data-cn-q] [data-cn-right]").nth(1).click(); await sleep(200);
  ok("EDIT: верный ответ — зелёный кружок (как в редакторе уроков), второй вариант", (await o.page.locator('[data-cn-q] [data-cn-right="1"]').count()) === 1
    && (await o.page.locator("[data-cn-q] [data-cn-right]").nth(1).getAttribute("data-cn-right")) === "1");
  const miss2 = await lensMiss(o.page);
  ok("EDIT: «Линза» — блок: «Ж», «Список», «Заголовок», «Улучшить текст», «Для кого» (выбранное — плашкой), вопрос кромкой, кнопки вопроса",
    !miss2.length && (await o.page.locator('[data-cn-track="manager"][data-lens-btn="tab"]').count()) === 1 && (await o.page.locator('[data-cn-track="core"][data-lens-btn="soft"]').count()) === 1
    && (await o.page.locator("[data-cn-q][data-lens-edge]").count()) === 1, JSON.stringify(miss2));
  await scrollAll(o.page); await sleep(300);
  await shot(o.page, "edit-block");
  await o.page.locator("[data-cn-save]").click();
  ok("EDIT: сохранено — снова список, «Атмосфера» в нём", !!(await until(() => o.page.locator('[data-cn-row="mood"]').count(), 5000)) && /Сохранено/.test(await txt(o.page.locator("[data-cn-msg]"))));
  const blk = srv.rpc("concept_get", { p_token: tok(MARIA) }).venue.blocks.find((b) => b.kind === "mood");
  ok("EDIT: на сервере: текст, «для кого» — новичок и менеджер, вопрос теста (верный — «После 19:00»)", !!blk && blk.tracks.join(",") === "manager,seasonal" && blk.questions.length === 1
    && blk.questions[0].correct === 1 && blk.questions[0].options[1] === "После 19:00" && /джаз/.test(blk.body), JSON.stringify(blk));
  await shot(o.page, "edit-saved");
  await scrollAll(o.page); await sleep(300);
  await o.page.locator("[data-cn-notify]").click();
  ok("EDIT: «Сообщить команде» — бот Анне: «Обновили «О нас»…», кнопка «О нас»", !!(await until(() => srv.pings.some((p) => p.to === "e-anna" && /^Обновили «О нас»/.test(p.text) && p.o && p.o.kb[0][0].go === "about"), 5000)),
    JSON.stringify(srv.pings.slice(-2)));
  ok("EDIT: сообщение о том, скольким ушло", /Сообщение ушло: \d+ из \d+/.test(await txt(o.page.locator("[data-cn-msg]"))), await txt(o.page.locator("[data-cn-msg]")));
  await o.page.locator("[data-cn-reads]").click(); await sleep(800);
  ok("EDIT: «Кто прочитал» — «Прочитали 0 из …» и кто ещё нет", /^0\/\d+$/.test(await o.page.locator("[data-cn-readlist]").getAttribute("data-cn-readlist")) && /Ещё нет: .*Анна Смирнова/.test(await body(o.page)));
  await shot(o.page, "edit-team");
  await o.page.locator("[data-cn-doc]").click(); await sleep(400);
  const miss3 = await lensMiss(o.page);
  ok("EDIT: «Линза» — «Из документа»: поле, «Прикрепить PDF», «Разложить», «Отмена»", !miss3.length && (await o.page.locator("[data-cn-docbox][data-lens-card]").count()) === 1, JSON.stringify(miss3));
  const [e1, e2] = noErr(o); ok("EDIT: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("NET", async () => {
  const srv = srvOf();
  const o = await open({ who: ROMAN, srv });
  await nav(o.page, "teamHub", 1600); await openGroups(o.page); await sleep(500);
  await hubItem(o.page, "Концепция и стандарты").click(); await sleep(1600);
  ok("NET: у владельца — «Вся сеть» и заведение, выбор заведения", (await o.page.locator('[data-cn-tab="net"]').count()) === 1 && (await o.page.locator('[data-cn-tab="venue"]').count()) === 1 && (await o.page.locator("[data-cn-rest]").count()) === 1);
  const vs = await o.page.locator("[data-cn-rest] option").allInnerTexts();
  ok("NET: в выборе — все заведения сети из приложения (" + RESTAURANTS.length + "), своё первым", vs[0] === R0 && RESTAURANTS.every((r) => vs.includes(r)) && vs.length === new Set([R0, ...RESTAURANTS, "Порт"]).size, JSON.stringify(vs));
  ok("NET: «Линза» — вкладки одной капсулой (data-lens-seg), выбранная — плашкой", (await o.page.locator("[data-cn-tabs][data-lens-seg]").count()) === 1
    && (await o.page.locator('[data-cn-tab="venue"][data-lens-btn="tab"]').count()) === 1 && !(await o.page.locator('[data-cn-tab="net"]').getAttribute("data-lens-btn")));
  const missN = await lensMiss(o.page);
  ok("NET: «Линза» — выбор заведения и кнопки с метками", !missN.length, JSON.stringify(missN));
  await shot(o.page, "net-tabs");
  await o.page.locator('[data-cn-tab="net"]').click(); await sleep(400);
  ok("NET: «Вся сеть» выбрана — плашка переехала", (await o.page.locator('[data-cn-tab="net"][data-lens-btn="tab"]').count()) === 1 && !(await o.page.locator('[data-cn-tab="venue"]').getAttribute("data-lens-btn")));
  ok("NET: «Вся сеть» — четыре блока сети", (await o.page.locator("[data-cn-row]").count()) === 4);
  await o.page.locator("[data-cn-add]").click(); await sleep(400);
  await o.page.locator('[data-cn-kind="own"]').click(); await sleep(500);
  await o.page.locator("[data-cn-title]").fill("Музыка в зале");
  await o.page.locator("[data-cn-body]").fill("Плейлист сети, громкость не выше разговора.");
  await o.page.locator("[data-cn-save]").click();
  ok("NET: свой блок сети сохранён", !!(await until(() => o.page.locator('[data-cn-row="own"]').count(), 5000)) && srv.rpc("concept_get", { p_token: tok(ANNA) }).net.blocks.some((b) => b.title === "Музыка в зале"));
  await o.page.locator("[data-cn-rest]").selectOption("Порт"); await sleep(1500);
  ok("NET: другое заведение — его блоки («Порт»: 2)", (await o.page.locator('[data-cn-tab="venue"]').innerText()) === "Порт" && (await o.page.locator('[data-cn-tab="venue"]').click().then(() => sleep(300)).then(() => o.page.locator("[data-cn-row]").count())) === 2);
  await shot(o.page, "net-port");
  // заведение без сотрудников и без блоков (есть только в списке приложения) — правится так же
  const empty = RESTAURANTS.find((r) => r !== R0 && r !== "Порт");
  await o.page.locator("[data-cn-rest]").selectOption(empty); await sleep(1500);
  await o.page.locator('[data-cn-tab="venue"]').click(); await sleep(300);
  ok("NET: «" + empty + "» (сотрудников ещё нет) — вкладка с его названием, «Пока пусто.»", (await o.page.locator('[data-cn-tab="venue"]').innerText()) === empty && /Пока пусто\./.test(await body(o.page)));
  await o.page.locator("[data-cn-add]").click(); await sleep(400);
  await o.page.locator('[data-cn-kind="idea"]').click(); await sleep(500);
  await o.page.locator("[data-cn-body]").fill("Камчатская кухня и вид на вулканы.");
  await o.page.locator("[data-cn-save]").click();
  ok("NET: блок «" + empty + "» сохранён на сервере", !!(await until(() => o.page.locator('[data-cn-row="idea"]').count(), 5000))
    && srv.rpc("concept_get", { p_token: tok(ROMAN), p_restaurant: empty }).venue.blocks.length === 1);
  const [e1, e2] = noErr(o); ok("NET: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("GO", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv, go: "about" });
  ok("GO: ?go=about (кнопка бота и уведомление) — экран «О нас»", !!(await until(() => o.page.locator("[data-about]").count(), 6000)));
  const [e1, e2] = noErr(o); ok("GO: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("NOSTAGE", async () => {
  const srv = srvOf({ noStage49: true });
  const o = await open({ who: ANNA, srv });
  await nav(o.page, "teamHub", 1600); await openGroups(o.page); await sleep(500);
  ok("NOSTAGE: без этапа 49 у сотрудника пункта «О нас» нет", (await hubItem(o.page, "О нас").count()) === 0);
  await nav(o.page, "home", 1500);
  ok("NOSTAGE: в треке раздела «Наш ресторан» нет", !/Наш ресторан/.test(await body(o.page)));
  await o.ctx.close();
  const o2 = await open({ who: MARIA, srv });
  await nav(o2.page, "teamHub", 1600); await openGroups(o2.page); await sleep(500);
  await hubItem(o2.page, "Концепция и стандарты").click(); await sleep(1500);
  ok("NOSTAGE: руководителю — «Нужен этап 49»", /Нужен этап 49/.test(await body(o2.page)), (await body(o2.page)).slice(0, 200));
  const [e1, e2] = noErr(o2); ok("NOSTAGE: без ошибок", e1, e2);
  await o2.ctx.close();
});

await run("LIGHT", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv, light: true });
  await nav(o.page, "about", 1800);
  ok("LIGHT: «О нас» в светлой теме", (await o.page.locator('[data-about="ready"]').count()) === 1);
  await shot(o.page, "light-about");
  await o.page.locator("[data-cn-edit]").click(); await sleep(800);
  await o.page.locator('[data-cn-open="setting"]').click(); await sleep(900);
  ok("LIGHT: блок «Сервировка» в редакторе — фото и подпись", (await o.page.locator("[data-cn-ph]").count()) === 1 && /Стол на двоих/.test(await o.page.locator("[data-cn-ph] input").inputValue()));
  await shot(o.page, "light-block");
  const [e1, e2] = noErr(o); ok("LIGHT: без ошибок", e1, e2);
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
