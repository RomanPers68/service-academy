// e2e v138 (Доп. 453): приложение с экрана «Домой» на iPhone снова в прежнем окне. Владелец (05.11, запись экрана v137):
// «Навбар почему-то вверх уехал, и в чате теперь вверх мутный», «Плейс так же взлетел. Хотя его на пару пикселей нужно
// было поднять, чтобы он не выглядел обрезанным», «В телеге всё норм». v137 добавлял viewport-fit=cover, и iOS 26 держала
// окно на 62 точки короче экрана. Теперь окно как было: iOS сама держит приложение под часами, вырезы env() — 0. Chromium
// так не умеет, поэтому окно — как у iPhone на экране «Домой»: высота экрана без строки с часами (16 Pro Max: 956 − 62),
// env() — 0, screen — весь экран, navigator.standalone.
// Разделы: HOME (16 Pro Max стоя: класс sa-pwa, viewport без cover, --sa-st нет; верхняя строка ниже размытия iOS 26;
// панель вкладок на прежнем месте, 16 px от низа, отступ под ней 88; переписка: шапка с верха окна, строка ввода на 28 px
// от низа (8 + 20, как в Telegram), панель строки до края), MINI (13 mini: тоже 20), SE (iPhone SE: полоски «Домой» нет,
// 8 px, как было), LAND (лёжа: 20 снизу, без отступа сверху), SAFARI (тот же iPhone в Safari: как было), TG (Telegram
// сообщает вырез 20 сам: как было), IPAD (iPad с экрана «Домой»: как было).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v138.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5338, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v138";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
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
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: plan(), menu: [], tgLinked: ["u-maria", "e-anna", "e-petr", "u-roman"],
    progress: { "e-anna": ["s0-1", "s0-2"] }, ping: () => {}, push: () => {} });
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

async function open({ who = ANNA, srv, w, h, scr, ua, cfg = {} }) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, screen: scr || { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce", userAgent: ua });
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
  const seed = { sa_a11y: "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
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
  await page.goto(ORIGIN + "/", { waitUntil: "load", timeout: 30000 });
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

// где что стоит (px от верха окна)
const geo = (page) => page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
  const cs = getComputedStyle(document.documentElement), tp = document.querySelector(".sa-tabpad");
  return { pwa: document.documentElement.classList.contains("sa-pwa"), meta: document.querySelector('meta[name="viewport"]').getAttribute("content"),
    st: cs.getPropertyValue("--sa-st").trim(), sb: cs.getPropertyValue("--sa-sb").trim(), pwab: cs.getPropertyValue("--sa-pwab").trim(), body: getComputedStyle(document.body).paddingTop,
    bar: r("[data-sa-topbar]"), search: r("[data-top-search]"), tab: r("#sa-tabbar"), root: r("#root"), vh: innerHeight, tabpad: tp ? getComputedStyle(tp).paddingBottom : "",
    chatBar: r(".ch-bar"), input: r(".ch-bar .ch-fieldwrap") || r(".ch-bar textarea"), bell: r(".ch-bar .ch-bell"), head: r(".ch-head"),
    headPad: document.querySelector(".ch-head") ? getComputedStyle(document.querySelector(".ch-head")).paddingTop : "" };
});
const openChat = async (page, srv) => {
  const m = srv.bot.say("u-maria", "Банкет на веранде в субботу, кто свободен?");
  await page.evaluate((go) => window.__swGo(go), "chat_1_" + m.id);
  const okc = await until(() => page.locator(".ch-bar").count(), 6000);
  await sleep(900);
  return okc;
};

await run("HOME", async () => {
  // iPhone 16 Pro Max (440 × 956), экран «Домой»: iOS держит приложение под часами (окно 956 − 62 = 894), вырезы env() — 0
  const srv = srvOf();
  const o = await open({ srv, w: 440, h: 894, scr: { width: 440, height: 956 }, ua: IPHONE("26_1"), cfg: { standalone: true } });
  const g = await geo(o.page);
  ok("HOME: экран «Домой» узнан (класс sa-pwa), viewport прежний, без viewport-fit=cover", g.pwa && g.meta === "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no", JSON.stringify([g.pwa, g.meta]));
  ok("HOME: верх как был: --sa-st нет, у body отступа нет, #root с верха окна", !g.st && g.body === "0px" && g.root && g.root.t === 0, JSON.stringify([g.st, g.body, g.root]));
  ok("HOME: верхняя строка ниже размытия iOS 26: отступ 8 + 36, лупа с 44 px (в Safari с 8)", g.pwab === "36px" && g.bar && g.bar.t === 0 && g.search && g.search.t >= 42 && g.search.t <= 48, JSON.stringify([g.pwab, g.bar, g.search]));
  ok("HOME: панель вкладок на прежнем месте: 16 px от низа окна (894 − 16 = 878)", g.tab && g.tab.b === 878, JSON.stringify(g.tab));
  ok("HOME: отступ под панелью вкладок прежний, 88 px", g.tabpad === "88px", g.tabpad);
  ok("HOME: вырез снизу для нижних строк окон — 20 px (как сообщает Telegram)", g.sb === "20px", g.sb);
  await shot(o.page, "home-promax");
  ok("HOME: открыли переписку", await openChat(o.page, srv));
  const c = await geo(o.page);
  ok("HOME: шапка переписки — с верха окна, отступ сверху 6 px, как до v137 (в v137 было 62)", c.head && c.head.t === 0 && c.headPad === "6px", JSON.stringify([c.head, c.headPad]));
  ok("HOME: строка ввода — на 28 px от низа (8 + 20): поле и колокольчик кончаются на 866", c.input && c.input.b === 866 && c.bell && c.bell.b === 866, JSON.stringify([c.input, c.bell]));
  ok("HOME: панель строки ввода — до самого края", c.chatBar && c.chatBar.b === 894, JSON.stringify(c.chatBar));
  await shot(o.page, "home-promax-chat");
  const [e1, e2] = noErr(o); ok("HOME: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("MINI", async () => {
  // iPhone 13 mini (375 × 812): полоска «Домой» есть, строка с часами 50
  const srv = srvOf();
  const o = await open({ srv, w: 375, h: 762, scr: { width: 375, height: 812 }, ua: IPHONE("18_6"), cfg: { standalone: true } });
  const g = await geo(o.page);
  ok("MINI: вырез снизу 20 px, панель вкладок 16 px от низа", g.pwa && g.sb === "20px" && g.tab && g.tab.b === 762 - 16, JSON.stringify([g.pwa, g.sb, g.tab]));
  ok("MINI: открыли переписку", await openChat(o.page, srv));
  const c = await geo(o.page);
  ok("MINI: строка ввода на 28 px от низа", c.input && c.input.b === 762 - 28, JSON.stringify(c.input));
  const [e1, e2] = noErr(o); ok("MINI: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SE", async () => {
  // iPhone SE (375 × 667): кнопка «Домой», полоски нет, строка с часами 20
  const srv = srvOf();
  const o = await open({ srv, w: 375, h: 647, scr: { width: 375, height: 667 }, ua: IPHONE("18_6"), cfg: { standalone: true } });
  const g = await geo(o.page);
  ok("SE: экран «Домой» узнан, но выреза снизу нет (0 px)", g.pwa && g.sb === "0px", JSON.stringify([g.pwa, g.sb]));
  ok("SE: открыли переписку", await openChat(o.page, srv));
  const c = await geo(o.page);
  ok("SE: строка ввода — как было, 8 px от низа", c.input && c.input.b === 647 - 8, JSON.stringify(c.input));
  await shot(o.page, "se-chat");
  const [e1, e2] = noErr(o); ok("SE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("LAND", async () => {
  // 16 Pro Max лёжа: часов нет, полоска «Домой» внизу по центру
  const srv = srvOf();
  const o = await open({ srv, w: 956, h: 440, scr: { width: 440, height: 956 }, ua: IPHONE("26_1"), cfg: { standalone: true } });
  const g = await geo(o.page);
  ok("LAND: без отступа под размытие (лёжа часов нет), --sa-st нет", !g.pwab && !g.st, JSON.stringify([g.pwab, g.st]));
  ok("LAND: вырез снизу 20 px", g.sb === "20px", g.sb);
  ok("LAND: открыли переписку", await openChat(o.page, srv));
  const c = await geo(o.page);
  ok("LAND: строка ввода на 28 px от низа", c.input && c.input.b === 440 - 28, JSON.stringify(c.input));
  await shot(o.page, "land-chat");
  const [e1, e2] = noErr(o); ok("LAND: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SAFARI", async () => {
  // тот же iPhone в Safari: класса нет, всё как было
  const srv = srvOf();
  const o = await open({ srv, w: 440, h: 832, scr: { width: 440, height: 956 }, ua: IPHONE("26_1") });
  const g = await geo(o.page);
  ok("SAFARI: класса sa-pwa нет, viewport прежний, лупа с 8 px", !g.pwa && !/viewport-fit/.test(g.meta) && g.search && g.search.t >= 6 && g.search.t <= 10, JSON.stringify([g.pwa, g.meta, g.search]));
  ok("SAFARI: выреза снизу нет, панель вкладок 16 px от низа", g.sb === "0px" && g.tab && g.tab.b === 832 - 16, JSON.stringify([g.sb, g.tab]));
  ok("SAFARI: открыли переписку", await openChat(o.page, srv));
  const c = await geo(o.page);
  ok("SAFARI: строка ввода — 8 px от низа, как было", c.input && c.input.b === 832 - 8, JSON.stringify(c.input));
  const [e1, e2] = noErr(o); ok("SAFARI: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("TG", async () => {
  // Telegram на том же iPhone сообщает вырез снизу сам (20): строка ввода там, где была; класса нет
  const srv = srvOf();
  const o = await open({ srv, w: 440, h: 956, scr: { width: 440, height: 956 }, ua: IPHONE("26_1"), cfg: { tg: { bottom: 20 } } });
  const g = await geo(o.page);
  ok("TG: класса sa-pwa нет, вырез снизу от Telegram — 20 px, лупа с 8 px", !g.pwa && g.sb === "20px" && g.search && g.search.t >= 6 && g.search.t <= 10, JSON.stringify([g.pwa, g.sb, g.search]));
  ok("TG: открыли переписку", await openChat(o.page, srv));
  const c = await geo(o.page);
  ok("TG: строка ввода на 28 px от низа, как было", c.input && c.input.b === 956 - 28, JSON.stringify(c.input));
  const [e1, e2] = noErr(o); ok("TG: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("IPAD", async () => {
  // iPad с экрана «Домой» (Safari на iPad называет себя Mac): как было
  const srv = srvOf();
  const o = await open({ srv, w: 820, h: 1156, scr: { width: 820, height: 1180 }, ua: IPAD, cfg: { standalone: true } });
  const g = await geo(o.page);
  ok("IPAD: класс sa-pwa есть, выреза снизу нет (0 px)", g.pwa && g.sb === "0px", JSON.stringify([g.pwa, g.sb]));
  const [e1, e2] = noErr(o); ok("IPAD: без ошибок", e1, e2);
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
