// e2e v99 (Доп. 412): удобство каждый день. Сервер — tools/claude/demo-app/fake-server.js (этап 39 там же, сообщения бота
// в Telegram — в список pings), время в телефоне — 11:00 (Камчатка): у Анны и Марии смена с 12:00. Разделы:
//   LATE    — «Опаздываю?» на главной (окно: за 3 часа до смены и 2 часа после начала; в 15:00 строки нет), лист в чате:
//             смена, минуты, причина, предпросмотр; карточка «Буду в 12:15»; бот — руководителю в смене с «Принято»;
//             «Принято» у Марии → у Анны «Принято: Мария К.»; Анне бот не пишет, пока она в чате; чаще раза в 3 минуты —
//             нельзя; отметка в «Графике» (late_month, «Сегодня» у руководителя); строка в «Смене»;
//   MENTION — «@Ма» → «Мария» (без «все» у официанта), вставка, на сервере упоминание и сообщение бота; «@все»
//             руководителя: значок «@» в списке чатов, подсветка, бот всем кроме автора, второй «@все» за 10 минут — нет;
//   DRAFT   — недописанное ждёт: «Черновик:» в списке, после перезагрузки — в строке ввода; отправил — черновика нет;
//   SEARCH  — поиск по всем чатам и в одном (p_chat), одна буква — подсказка без запроса, нажатие — переписка на месте,
//             без этапа 39 — понятная строка;
//   CAL     — «Смены в календаре телефона»: ближайшие смены, «Подписаться» (страница /api/cal?k=…&page=1), ссылка и
//             «Скопировать», «Сбросить ссылку» (новый ключ, старый не работает), без этапа — строка; «В календарь» в «Графике»;
//   SERVER  — «Команда» → «Сервер» у владельца: этапы, бот, «Подключить бота» (ссылка tg-bot?setup=<код>, адрес
//             приложения), повторная проверка; нет этапов — по пунктам; без этапа 39 — «Нужен этап 39»; у Марии пункта нет;
//   TGLOGIN — открыто в Telegram без входа: «Узнаю тебя по Telegram…» → вошла; этот Telegram запомнен (tg_auth_bind);
//             «Выйти» → tg_auth_off и экран входа без попытки; незнакомый Telegram — подсказка и поле кода; ссылка-приглашение —
//             без попытки;
//   GUIDE   — новые пункты гида; «Сервер» — только владельцу;
//   NARROW  — 320 px, светлая тема: лист «Опаздываю», подсказки «@», поиск, лист календаря, «Сервер» помещаются.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v99.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const TZ = "Asia/Kamchatka";
process.env.TZ = TZ;   // часы сервера-заглушки — как у телефона и заведения
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site99", PORT = Number(process.env.E2E_PORT) || 5299, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v99";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v99";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { buildIcs } = await import(SRC + "/lib/ical.js");
const { REPO_URL } = await import(SRC + "/lib/server-check.js");
const SUPABASE_URL = "https://gvxhgdynjuaisswplroh.supabase.co";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

// ── сегодня и время в телефоне: 11:00 по Камчатке (UTC+12, без перехода на летнее время) ──
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const D = (n) => addD(TODAY, n);
const MK = TODAY.slice(0, 7);
const at = (hm) => Date.parse(TODAY + "T" + hm + ":00+12:00");

const R0 = "Два моря, Океан";
const P = (id, name, surname, position, is_admin = false) => ({ id, name, surname, restaurant: R0, position, is_admin });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter");
const PETR = P("e-petr", "Пётр", "Орлов", "waiter"), VERA = P("e-vera", "Вера", "Соколова", "waiter"), DARYA = P("e-darya", "Дарья", "Лебедева", "waiter"), ILYA = P("e-ilya", "Илья", "Белов", "bartender");
const ROMAN = P("u-roman", "Роман", "", "owner", true);
const PEOPLE = [MARIA, OLGA, ANNA, PETR, VERA, DARYA, ILYA, ROMAN];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 }, { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 },
  { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } }, split: {},
  rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: { waiter: { pattern: "even" } }, dayShift: "Д", staff: SSTAFF };
// две недели от сегодня по дням: сегодня у Анны, Марии и Дарьи «День» (12–20), у Петра «Вечер»
const NEAR = { 3: "ДД-ВВ--ДД-ВВ--", 4: "В-ДД-ВВ-ДД-ВВ-", 5: "-ВВ-ДД-В-ДД-ВВ", 6: "Д--Д--Д-В--Д-Д" };
function planOf() {
  const out = {};
  for (let i = -31; i <= 62; i++) {
    const set = (sid, k) => { if (k && k !== "-") (out[sid] = out[sid] || {})[i] = k; };
    const c2 = ((i % 4) + 4) % 4;
    set(1, c2 < 2 ? "Д" : ""); set(2, c2 >= 2 ? "Д" : ""); set(7, c2 === 1 || c2 === 2 ? "В" : "");
    for (const sid of [3, 4, 5, 6]) { const row = NEAR[sid]; set(sid, i >= 0 && i < row.length ? row[i] : row[((i % row.length) + row.length) % row.length]); }
  }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0]));
const TG_ANNA = 700003;
// сервер: часы — как в телефоне (t0 — «сейчас» на телефоне в момент старта), сообщения бота — в pings
function newServer({ seed = true, t0 = at("11:00") } = {}) {
  const r0 = Date.now(), pings = [];
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU, clock: () => t0 + (Date.now() - r0),
    tgKnown: { [String(TG_ANNA)]: "e-anna" }, ping: (to, text, acts, chat, msg) => pings.push({ to, text, acts, chat, msg }),
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"] } });
  s.calls = []; s.pings = pings; s.now = () => t0 + (Date.now() - r0);
  if (seed) {
    s.bot.say("u-maria", "Доброе утро! Сегодня банкет на 12 человек в 19:00.");
    s.ilya = s.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут.");
    s.bot.say("e-olga", "Бронь на 20:00 перенесли на 20:30, стол 7.");
    s.S.seen = {};   // утро: никто сейчас не в чате
  }
  return s;
}

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Telegram без клавиатуры: только то, что нужно входу (initData) и ссылкам (openLink — в __opened)
const TG = ({ init, id, start = "" }) => {
  const nop = () => {};
  window.__opened = window.__opened || [];
  window.Telegram = { WebApp: {
    platform: "ios", version: "8.0", initData: init, initDataUnsafe: { user: { id, first_name: "Анна" }, ...(start ? { start_param: start } : {}) }, colorScheme: "dark", themeParams: {},
    isExpanded: true, isFullscreen: false, safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 }, contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    get viewportHeight() { return window.innerHeight; }, get viewportStableHeight() { return window.innerHeight; },
    onEvent: nop, offEvent: nop, ready: nop, expand: nop, close: nop, disableVerticalSwipes: nop, enableVerticalSwipes: nop, requestFullscreen: nop, exitFullscreen: nop, lockOrientation: nop,
    setHeaderColor: nop, setBackgroundColor: nop, setBottomBarColor: nop, isVersionAtLeast: () => true, openLink: (u) => window.__opened.push(String(u)), openTelegramLink: nop, downloadFile: nop,
    showAlert: (m, cb) => { if (cb) cb(); }, showConfirm: (m, cb) => { if (cb) cb(true); }, requestWriteAccess: (cb) => { if (cb) cb(false); },
    BackButton: { show: nop, hide: nop, onClick: nop, offClick: nop, isVisible: false }, MainButton: { show: nop, hide: nop, setText: nop, onClick: nop, offClick: nop, setParams: nop },
    HapticFeedback: { impactOccurred: nop, notificationOccurred: nop, selectionChanged: nop },
  } };
};
const initOf = (id) => "query_id=AA1&user=" + encodeURIComponent(JSON.stringify({ id, first_name: "Анна" })) + "&auth_date=" + Math.floor(Date.now() / 1000) + "&hash=e2e";

async function open({ who = ANNA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, path = "/", seedExtra = {}, login = true, tg = null, time = null } = {}) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN }).catch(() => {});
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      srv.calls.push({ fn: m[1], body, who: who.id, t: Date.now() });
      let own = rpcs(m[1], body);
      if (own === undefined) own = srv.rpc(m[1], body);
      return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own === undefined ? null : own) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: MENU }), sa_boot_missing: String(Date.now()), ...seedExtra };
  if (login) { seed.sa_session_token = tok(who); seed.sa_profile = JSON.stringify(who); }
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  // ссылки наружу (календарь, бот) — в __opened, а не в новую вкладку
  await ctx.addInitScript(() => { window.__opened = window.__opened || []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
  if (tg) await ctx.addInitScript(TG, tg);
  const page = await ctx.newPage();
  await page.clock.install({ time: time != null ? time : srv.now() });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== "hidden" && !(cs.position === "absolute" && !String(e.textContent || "").trim()) && (r.right > W + 1 || r.left < -1) && !e.closest("[data-sa-offscreen], .sa-dlgscroll, .ch-chips, .ch-mb, [aria-hidden='true']"); }).map((e) => (e.className && String(e.className).slice(0, 40)) || e.tagName); return { ok: document.documentElement.scrollWidth <= W && !over.length, over: over.slice(0, 4) }; });
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const lastCall = (srv, fn) => [...srv.calls].reverse().find((c) => c.fn === fn) || null;
const calls = (srv, fn) => srv.calls.filter((c) => c.fn === fn);
const openDock = async (page) => { await page.locator("[data-chat-dock]").first().click(); await until(async () => (await page.locator("[data-chat]").count()) === 1, 4000); await sleep(700); };
const openTeam = async (page) => { await openDock(page); await page.locator("[data-chat-item='team']").click(); await sleep(1300); };
const toList = async (page) => { for (let i = 0; i < 3 && (await page.locator("[data-chat] [data-chat-item]").count()) === 0 && (await page.locator("[data-chat]").count()); i++) { await page.locator("[data-chat] .ch-back").first().click({ timeout: 3000 }).catch(() => {}); await sleep(700); } };
const chatClose = async (page) => { for (let i = 0; i < 4 && (await page.locator("[data-chat]").count()); i++) { await page.locator("[data-chat] [data-sa-back]").first().click({ timeout: 3000 }).catch(() => {}); await sleep(600); } };
const input = (page) => page.locator("[data-chat] textarea.ch-input");
const send = async (page) => { await page.locator("[data-chat-send]").click(); await sleep(900); };
const opened = (page) => page.evaluate(() => (window.__opened || []).slice());

// ── LATE: «Опаздываю» ──
await run("LATE", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  ok("LATE: на главной «Опаздываю?» (сейчас 11:00, смена с 12:00)", await until(async () => /Опаздываю\? ?предупредить/.test(await body(a.page)), 8000));
  await shot(a.page, "late-home");
  await a.page.getByText("Опаздываю?").first().click();
  ok("LATE: открылся чат «Вся команда» и лист «Опаздываю»", await until(async () => (await a.page.locator("[data-chat-latesheet]").count()) === 1, 6000));
  ok("LATE: в листе — смена сегодня «день 12:00–20:00»", await until(async () => (await a.page.locator("[data-chat-late-shift]").getAttribute("data-chat-late-shift")) === "12:00–20:00", 4000),
    await a.page.locator("[data-chat-late-shift]").getAttribute("data-chat-late-shift").catch(() => ""));
  await a.page.locator('[data-chat-latemin="15"]').click();
  await a.page.locator("[data-chat-latenote]").fill("пробка на мосту");
  const pv = await txt(a.page.locator("[data-chat-late-preview]"));
  ok("LATE: предпросмотр «Опаздываю на 15 минут: буду в 12:15. пробка на мосту»", pv === "Опаздываю на 15 минут: буду в 12:15. пробка на мосту", pv);
  await shot(a.page, "late-sheet");
  await a.page.locator("[data-chat-latego]").click();
  ok("LATE: карточка «Буду в 12:15» в чате", await until(async () => (await a.page.locator("[data-chat-late-eta='12:15']").count()) === 1, 5000));
  const lc = lastCall(srv, "chat_late");
  ok("LATE: chat_late(p_chat — «Вся команда», 15 минут, причина)", !!lc && lc.body.p_chat === srv.teamOf(R0).id && lc.body.p_min === 15 && lc.body.p_note === "пробка на мосту", JSON.stringify(lc && lc.body));
  ok("LATE: у автора «Ждём ответа руководителя», кнопки «Принято» нет", (await a.page.locator("[data-chat-late-wait]").count()) === 1 && (await a.page.locator("[data-chat-lateok]").count()) === 0);
  const pl = srv.pings.filter((p) => /опаздывает/.test(p.text));
  ok("LATE: бот написал руководителю в смене (Марии), с кнопкой «Принято»; Роману (не в смене) — нет", pl.map((p) => p.to).join() === "u-maria" && pl[0].acts && pl[0].acts[0].text === "Принято"
    && pl[0].text === "Анна С. опаздывает на 15 минут: будет в 12:15 (смена с 12:00).\n«пробка на мосту»", JSON.stringify(pl));
  const lm = srv.rpc("late_month", { p_token: tok(MARIA), p_month: MK }).rows;
  ok("LATE: отметка для «Графика»: Анна, строка 3, к 12:15", lm.some((r) => r.emp === "e-anna" && r.sid === "3" && r.eta === "12:15" && r.min === 15 && r.note === "пробка на мосту"), JSON.stringify(lm));
  ok("LATE: свои отметки — только свои (Пётр не видит Анну)", srv.rpc("late_month", { p_token: tok(PETR), p_month: MK }).rows.length === 0);
  await shot(a.page, "late-card");
  // Мария: «Принято» на карточке
  const m = await open({ who: MARIA, srv });
  await openTeam(m.page);
  ok("LATE: у Марии на карточке кнопка «Принято»", await until(async () => (await m.page.locator("[data-chat-lateok]").count()) === 1, 5000));
  await m.page.locator("[data-chat-lateok]").click();
  ok("LATE: у Марии — «Принято: Мария К.»", await until(async () => /Принято: Мария К\./.test(await txt(m.page.locator("[data-chat-late-ok]"))), 5000));
  ok("LATE: у Анны карточка обновилась сама: «Принято: Мария К.»", await until(async () => /Принято: Мария К\./.test(await txt(a.page.locator("[data-chat-late-ok]"))), 15000));
  ok("LATE: Анне бот не писал «принято»: она сейчас в чате", !srv.pings.some((p) => p.to === "e-anna"), JSON.stringify(srv.pings.filter((p) => p.to === "e-anna")));
  ok("LATE: отметка в графике — «принято»", srv.rpc("late_month", { p_token: tok(MARIA), p_month: MK }).rows.some((r) => r.emp === "e-anna" && r.ok === "Мария Ким"));
  await shot(m.page, "late-maria");
  // повторно — чаще раза в 3 минуты нельзя
  await a.page.locator("[data-chat-attach]").click(); await sleep(600);
  await a.page.locator("[data-chat-tile='late'], [data-chat-act='late']").first().click({ timeout: 3000 }).catch(async () => { await a.page.getByRole("button", { name: "Опаздываю" }).first().click(); });
  await until(async () => (await a.page.locator("[data-chat-latesheet]").count()) === 1, 3000);
  await a.page.locator("[data-chat-latego]").click();
  ok("LATE: второй раз через минуту — «не так часто» (и карточки нет)", await until(async () => (await a.page.locator("[data-chat-late-err]").count()) === 1, 4000)
    && srv.S.msgs.filter((x) => x.card && x.card.t === "late" && x.emp === "e-anna").length === 1, await txt(a.page.locator("[data-chat-late-err]")));
  await shot(a.page, "late-again");
  await chatClose(a.page);
  // «Смена»: строка «Опаздываю»
  await nav(a.page, "shift", 1500);
  ok("LATE: во вкладке «Смена» строка «Опаздываю»", /Опаздываю Предупредить руководителя и команду/.test(await body(a.page)));
  // «Сегодня» в графике руководителя: опаздывает Анна, принято
  await chatClose(m.page);
  await nav(m.page, "schedule", 2600);
  ok("LATE: «График» у Марии: «Сегодня» — значок у Анны и «опаздывает: Смирнова Анна к 12:15 (принято)»", await until(async () => /опаздывает: Смирнова Анна к 12:15 \(принято\)/.test(await txt(m.page.locator("[data-today-lates]"))), 6000)
    && (await m.page.locator("[data-today-late='3']").count()) === 1, await txt(m.page.locator("[data-today-lates]")));
  await shot(m.page, "late-schedule");
  // свой «График» у Анны: отметка в календаре на сегодня
  await nav(a.page, "schedule", 2600);
  ok("LATE: у Анны в календаре на сегодня — отметка", await until(async () => (await a.page.locator(`[data-cal-late="${Number(TODAY.slice(8))}"]`).count()) === 1, 6000));
  // вне окна: 15:00 — строки на главной нет
  const s2 = newServer({ t0: at("15:00") });
  const b = await open({ who: ANNA, srv: s2 });
  await sleep(2500);
  ok("LATE: в 15:00 (смена с 12:00, прошло больше 2 часов) на главной «Опаздываю?» нет", !/Опаздываю\?/.test(await body(b.page)));
  const [e1, e2] = noErr(a, m, b);
  ok("LATE: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await m.ctx.close(); await b.ctx.close();
});

// ── MENTION: упоминания ──
await run("MENTION", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  await input(a.page).click(); await input(a.page).type("@Ма", { delay: 30 });
  ok("MENTION: «@Ма» — подсказка «Мария», «все» официанту не предлагается", await until(async () => (await a.page.locator('[data-chat-mention="u-maria"]').count()) === 1, 3000)
    && (await a.page.locator('[data-chat-mention="all"]').count()) === 0);
  await shot(a.page, "mention-suggest");
  await a.page.locator('[data-chat-mention="u-maria"]').click(); await sleep(300);
  ok("MENTION: вставлено «@Мария »", (await input(a.page).inputValue()) === "@Мария ", await input(a.page).inputValue());
  ok("MENTION: подсказки скрылись", (await a.page.locator("[data-chat-mentions]").count()) === 0);
  await input(a.page).type("проверь стол 7", { delay: 10 });
  await send(a.page);
  const mm = srv.S.msgs.filter((x) => x.emp === "e-anna" && x.kind === "text").pop();
  ok("MENTION: на сервере — упоминание Марии", !!mm && (mm.ment || []).join() === "u-maria", JSON.stringify(mm && mm.ment));
  ok("MENTION: бот Марии: «Анна С. упоминает тебя в «Вся команда»: …»", srv.pings.some((p) => p.to === "u-maria" && p.text === "Анна С. упоминает тебя в «Вся команда»:\n@Мария проверь стол 7"), JSON.stringify(srv.pings));
  ok("MENTION: в своём сообщении «@Мария» выделено", (await a.page.locator(`[data-chat-msg="${mm.id}"] [data-chat-at="u-maria"]`).count()) === 1);
  // «@все» от Марии, пока Анна в списке чатов
  await toList(a.page);
  for (const k of Object.keys(srv.S.seen)) if (k.endsWith("|e-anna")) srv.S.seen[k] -= 61000;   // Анна вышла из переписки больше минуты назад
  srv.bot.say("u-maria", "@все в 18:30 брифинг перед банкетом");
  ok("MENTION: в списке чатов у «Вся команда» значок «@» (1)", await until(async () => (await a.page.locator("[data-chat-item='team'] [data-chat-ment]").getAttribute("data-chat-ment").catch(() => "")) === "1", 15000));
  await shot(a.page, "mention-badge");
  const all = srv.pings.filter((p) => /пишет всем/.test(p.text)).map((p) => p.to).sort();
  ok("MENTION: «@все» — бот всем участникам, кроме Марии", all.join() === ["e-anna", "e-darya", "e-ilya", "e-olga", "e-petr", "e-vera", "u-roman"].join(), all.join());
  srv.bot.say("u-maria", "@все и ещё: форма белая");
  ok("MENTION: второй «@все» за 10 минут — без рассылки", srv.pings.filter((p) => /пишет всем/.test(p.text)).length === all.length);
  await a.page.locator("[data-chat-item='team']").click(); await sleep(1400);
  ok("MENTION: у Анны «@все» подсвечено как обращение к ней", await until(async () => (await a.page.locator(".ch-at.me[data-chat-at='all']").count()) >= 1, 4000));
  ok("MENTION: прочитала — значка «@» больше нет", await until(async () => { await toList(a.page); return (await a.page.locator("[data-chat-item='team'] [data-chat-ment]").count()) === 0; }, 8000));
  // Мария: «@» предлагает «все»
  const m = await open({ who: MARIA, srv });
  await openTeam(m.page);
  await input(m.page).click(); await input(m.page).type("@", { delay: 30 });
  ok("MENTION: руководителю — «все» первым в подсказках", await until(async () => (await m.page.locator("[data-chat-mentions] [data-chat-mention]").first().getAttribute("data-chat-mention").catch(() => "")) === "all", 3000));
  await shot(m.page, "mention-lead");
  const [e1, e2] = noErr(a, m);
  ok("MENTION: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await m.ctx.close();
});

// ── DRAFT: черновик ──
await run("DRAFT", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  await input(a.page).fill("Недописанное про банкет");
  await sleep(700);
  await toList(a.page);
  ok("DRAFT: в списке чатов «Черновик: Недописанное про банкет»", /Черновик: Недописанное про банкет/.test(await txt(a.page.locator("[data-chat-item='team']"))), await txt(a.page.locator("[data-chat-item='team']")));
  await shot(a.page, "draft-list");
  await a.page.reload({ waitUntil: "load" });
  await a.page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  await openTeam(a.page);
  ok("DRAFT: после перезапуска текст ждёт в строке ввода", (await input(a.page).inputValue()) === "Недописанное про банкет", await input(a.page).inputValue());
  await send(a.page);
  await toList(a.page);
  ok("DRAFT: отправила — черновика нет", (await a.page.locator("[data-chat-item='team'] [data-chat-draft]").count()) === 0);
  ok("DRAFT: хранилище очищено", await a.page.evaluate(() => !Object.keys(localStorage).some((k) => k.startsWith("sa_chat_draft:"))));
  const [e1, e2] = noErr(a);
  ok("DRAFT: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

// ── SEARCH: поиск по переписке ──
await run("SEARCH", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  await openDock(a.page);
  await a.page.locator("[data-chat-searchbtn]").click(); await sleep(500);
  await a.page.locator("[data-chat-q]").fill("т"); await sleep(900);
  ok("SEARCH: одна буква — подсказка, запроса нет", (await a.page.locator("[data-chat-search-hint]").count()) === 1 && !calls(srv, "chat_search").length);
  await a.page.locator("[data-chat-q]").fill("ТОНИК");
  ok("SEARCH: «ТОНИК» — одно сообщение Ильи, слово выделено", await until(async () => (await a.page.locator("[data-chat-sr]").count()) === 1, 4000)
    && (await txt(a.page.locator("[data-chat-sr] b"))) === "тоник" && /Илья Б\.:/.test(await txt(a.page.locator("[data-chat-sr]"))), await txt(a.page.locator("[data-chat-results]")));
  const sc = lastCall(srv, "chat_search");
  ok("SEARCH: chat_search по всем чатам (p_chat null)", !!sc && sc.body.p_q === "ТОНИК" && sc.body.p_chat === null, JSON.stringify(sc && sc.body));
  await shot(a.page, "search-all");
  await a.page.locator("[data-chat-sr]").first().click();
  ok("SEARCH: нажатие — переписка открыта на этом сообщении", await until(async () => { const r = await a.page.locator(`[data-chat-msg="${srv.ilya.id}"]`).boundingBox(); return !!r && r.y > 60 && r.y < 760; }, 5000));
  await shot(a.page, "search-jump");
  // в одном чате
  await a.page.locator("[data-chat-tsearch]").click(); await sleep(500);
  await a.page.locator("[data-chat-q]").fill("банкет");
  ok("SEARCH: в чате — поиск только по нему (p_chat = «Вся команда»)", await until(async () => { const c = lastCall(srv, "chat_search"); return !!c && c.body.p_q === "банкет" && c.body.p_chat === srv.teamOf(R0).id; }, 4000));
  ok("SEARCH: «банкет» нашлось", await until(async () => (await a.page.locator("[data-chat-sr]").count()) >= 1, 4000));
  await a.page.locator("[data-chat-q]").fill("кальмары по-гречески");
  ok("SEARCH: ничего — «Ничего не нашёл.»", await until(async () => (await a.page.locator("[data-chat-nofound]").count()) === 1, 4000));
  await a.page.locator("[data-chat-qx]").click(); await sleep(400);
  const qx = [await a.page.locator("[data-chat-q]").inputValue(), await a.page.locator("[data-chat-search-hint]").count(), await a.page.locator("[data-chat-qx]").count()];
  ok("SEARCH: золотой «×» очищает строку и прячется", qx[0] === "" && qx[1] === 1 && qx[2] === 0, JSON.stringify(qx));
  await chatClose(a.page);
  // без этапа 39
  const b = await open({ who: ANNA, srv, rpcs: (fn) => (fn === "chat_search" ? { code: "PGRST202", message: "x" } : undefined) });
  await openDock(b.page);
  await b.page.locator("[data-chat-searchbtn]").click(); await sleep(400);
  await b.page.locator("[data-chat-q]").fill("банкет");
  ok("SEARCH: без этапа 39 — «Поиск заработает, когда руководитель обновит сервер (этап 39).»", await until(async () => /Поиск заработает, когда руководитель обновит сервер \(этап 39\)\./.test(await txt(b.page.locator("[data-chat-search-err]"))), 4000));
  const [e1, e2] = noErr(a, b);
  ok("SEARCH: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

// ── CAL: смены в календаре телефона ──
await run("CAL", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "shift", 1500);
  await a.page.getByText("Смены в календаре телефона").first().click();
  ok("CAL: лист готов, ближайшие смены — 3", await until(async () => (await a.page.locator("[data-cal-sheet='ready']").count()) === 1, 5000) && (await a.page.locator("[data-cal-next]").getAttribute("data-cal-next")) === "3");
  const nx = await txt(a.page.locator("[data-cal-next]"));
  ok("CAL: первой — сегодня, день 12:00–20:00", /сегодня, \d{1,2} [а-я]+ · день 12:00–20:00/.test(nx), nx);
  const key = srv.S.cal["e-anna"].k, url = ORIGIN + "/api/cal?k=" + key;
  ok("CAL: ссылка — /api/cal?k=<32 знака> этого сайта", /^[0-9a-f]{32}$/.test(key) && (await a.page.locator("[data-cal-url]").inputValue()) === url);
  await shot(a.page, "cal-sheet");
  await a.page.locator("[data-cal-sub]").click(); await sleep(400);
  ok("CAL: «Подписаться» — страница подписки в браузере (&page=1)", (await opened(a.page)).includes(url + "&page=1"), JSON.stringify(await opened(a.page)));
  await a.page.locator("[data-cal-copy]").click();
  ok("CAL: «Скопировать ссылку» — «Ссылка скопирована», в буфере ссылка", await until(async () => /Ссылка скопирована/.test(await txt(a.page.locator("[data-cal-copy]"))), 3000)
    && (await a.page.evaluate(() => navigator.clipboard.readText().catch(() => ""))) === url);
  const feed = srv.rpc("cal_feed", { p_key: key });
  const ics = buildIcs(feed);
  ok("CAL: по ссылке — смены Анны за месяц назад и два вперёд (события календаря)", feed.ok && (ics.match(/BEGIN:VEVENT/g) || []).length === feed.shifts.length && feed.shifts.length > 30, String(feed.shifts && feed.shifts.length));
  await a.page.locator("[data-cal-sheet] [data-sa-back]").click(); await sleep(400);
  await a.page.getByText("Смены в календаре телефона").first().click();
  ok("CAL: календарь забирал смены — «Подписка работает»", await until(async () => /Календарь забирал смены: сегодня в \d{1,2}:\d{2}\. Подписка работает\./.test(await txt(a.page.locator("[data-cal-sheet]"))), 5000));
  await a.page.locator("[data-cal-reset]").click();
  ok("CAL: «Сбросить ссылку» спрашивает", /Сбросить\? Старая подписка перестанет обновляться/.test(await txt(a.page.locator("[data-cal-reset]"))));
  await a.page.locator("[data-cal-reset]").click();
  ok("CAL: сброшена — новый ключ, старый не работает, «Ссылка новая…»", await until(async () => srv.S.cal["e-anna"].k !== key, 4000) && !srv.rpc("cal_feed", { p_key: key }).ok
    && await until(async () => /Ссылка новая\. Старая подписка больше не обновляется: подпишись заново\./.test(await txt(a.page.locator("[data-cal-sheet]"))), 3000));
  await shot(a.page, "cal-reset");
  await a.page.locator("[data-cal-sheet] [data-sa-back]").click(); await sleep(400);
  // «В календарь» в «Графике»
  await nav(a.page, "schedule", 2500);
  ok("CAL: в «Графике» строка «Смены в календаре телефона» с «В календарь»", (await a.page.locator("[data-cal-phone]").count()) === 1);
  await a.page.locator("[data-cal-phone] button").click();
  ok("CAL: из «Графика» — тот же лист", await until(async () => (await a.page.locator("[data-cal-sheet='ready']").count()) === 1, 4000));
  // без этапа 39
  const b = await open({ who: ANNA, srv, rpcs: (fn) => (fn === "cal_key" ? { code: "PGRST202", message: "x" } : undefined) });
  await nav(b.page, "shift", 1500);
  await b.page.getByText("Смены в календаре телефона").first().click();
  ok("CAL: без этапа 39 — строка про сервер, без ссылки", await until(async () => (await b.page.locator("[data-cal-sheet='missing']").count()) === 1, 4000) && (await b.page.locator("[data-cal-sub]").count()) === 0,
    await txt(b.page.locator("[data-cal-sheet]")));
  const [e1, e2] = noErr(a, b);
  ok("CAL: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

// ── SERVER: экран «Сервер» у владельца ──
await run("SERVER", async () => {
  const srv = newServer();
  const r = await open({ who: ROMAN, srv });
  await nav(r.page, "teamHub", 1200);
  ok("SERVER: в «Команде» пункт «Сервер»", /Сервер Этапы базы, бот Telegram, расписания/.test(await body(r.page)));
  await r.page.getByText("Этапы базы, бот Telegram, расписания").first().click();
  ok("SERVER: экран готов: все этапы на месте, бот есть, вебхука нет", await until(async () => (await r.page.locator("[data-server='ready']").count()) === 1, 5000)
    && /Все этапы на месте/.test(await body(r.page)) && /Кнопки и ответы в чат: не подключены/.test(await body(r.page)));
  const sc = lastCall(srv, "server_check");
  ok("SERVER: server_check спрашивает функции и корзины этапов и адрес проекта", !!sc && sc.body.p_fns.includes("cal_feed") && sc.body.p_fns.includes("server_check") && sc.body.p_buckets.join() === "menu-photos,menu-voice" && sc.body.p_url === SUPABASE_URL,
    JSON.stringify(sc && { n: sc.body.p_fns.length, b: sc.body.p_buckets, u: sc.body.p_url }));
  await shot(r.page, "server");
  await r.page.locator("[data-srv-tgsetup]").click(); await sleep(600);
  const code = srv.S.srv.code, setup = lastCall(srv, "owner_tg_setup");
  ok("SERVER: «Подключить бота» — страница tg-bot?setup=<код>", /^[0-9a-f]{12}$/.test(code || "") && (await opened(r.page)).includes(SUPABASE_URL + "/functions/v1/tg-bot?setup=" + code), JSON.stringify(await opened(r.page)));
  ok("SERVER: адрес приложения передан (p_app)", !!setup && setup.body.p_app === ORIGIN);
  ok("SERVER: подсказка «Открылась страница бота…»", /Открылась страница бота: там написано, что подключилось/.test(await body(r.page)));
  srv.S.srv.hook = true;   // tg-bot поставил вебхук по коду
  ok("SERVER: через 4 с — проверка ещё раз: «подключены»", await until(async () => /Кнопки и ответы в чат: подключены/.test(await body(r.page)), 9000));
  ok("SERVER: кнопка — «Подключить бота заново»", /Подключить бота заново/.test(await txt(r.page.locator("[data-srv-tgsetup]"))));
  await shot(r.page, "server-hook");
  // этапов нет — по пунктам
  const b = await open({ who: ROMAN, srv, rpcs: (fn, x) => (fn === "server_check" ? { ...srv.rpc(fn, x), fns: x.p_fns.filter((f) => !["chat_person", "cal_feed", "brief_today"].includes(f)), cron: null } : undefined) });
  await nav(b.page, "server", 2500);
  const t = await body(b.page);
  ok("SERVER: нет этапов 32, 38, 39 и pg_cron — «Нужно сделать: 4», строки с файлами", /Нужно сделать: 4/.test(t) && /Этап 32/.test(t) && /Этап 38/.test(t) && /Этап 39/.test(t) && /pg_cron не включён/.test(t), t.slice(0, 300));
  const gh = b.page.getByRole("button", { name: "Файл на GitHub" });
  for (let i = 0, n = await gh.count(); i < n; i++) { await gh.nth(i).click(); await sleep(150); }
  const hrefs = await opened(b.page);
  ok("SERVER: «Файл на GitHub» у каждого этапа открывает его файл", [32, 38, 39].every((n) => hrefs.some((h) => h.startsWith(REPO_URL + "supabase-stage" + n + "-"))), JSON.stringify(hrefs));
  await shot(b.page, "server-missing");
  // этапа 39 нет вовсе
  const c = await open({ who: ROMAN, srv, rpcs: (fn) => (fn === "server_check" ? { code: "PGRST202", message: "x" } : undefined) });
  await nav(c.page, "server", 2500);
  ok("SERVER: без этапа 39 — «Нужен этап 39» и как его запустить", /Нужен этап 39/.test(await body(c.page)) && /SQL Editor/.test(await body(c.page)));
  // у Марии пункта нет, экран не открывается
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "teamHub", 1200);
  ok("SERVER: у менеджера в «Команде» пункта «Сервер» нет", !/Этапы базы, бот Telegram, расписания/.test(await body(m.page)));
  await nav(m.page, "server", 1200);
  ok("SERVER: у менеджера экран «Сервер» не открывается", (await m.page.locator("[data-server]").count()) === 0);
  ok("SERVER: и сервер отвечает менеджеру forbidden", srv.rpc("server_check", { p_token: tok(MARIA) }).error === "forbidden" && srv.rpc("owner_tg_setup", { p_token: tok(MARIA) }).error === "forbidden");
  const [e1, e2] = noErr(r, b, c, m);
  ok("SERVER: без ошибок в консоли", e1, e2);
  await r.ctx.close(); await b.ctx.close(); await c.ctx.close(); await m.ctx.close();
});

// ── TGLOGIN: вход через Telegram без кода ──
await run("TGLOGIN", async () => {
  const srv = newServer();
  const init = initOf(TG_ANNA);
  const a = await open({ who: ANNA, srv, login: false, tg: { init, id: TG_ANNA } });
  ok("TGLOGIN: без входа, в Telegram — «Узнаю тебя по Telegram…»", await until(async () => (await a.page.locator("[data-tg-login='try']").count()) === 1 || /Доброе|Добрый/.test(await body(a.page)), 6000));
  ok("TGLOGIN: tg_login с данными Telegram", await until(async () => { const c = lastCall(srv, "tg_login"); return !!c && c.body.p_init_data === init; }, 6000));
  ok("TGLOGIN: вошла без кода — главная Анны", await until(async () => /Анна/.test(await body(a.page)) && (await a.page.locator("[data-tg-login]").count()) === 0 && !/Введи код доступа/.test(await body(a.page)), 8000));
  ok("TGLOGIN: сервер уже знает этот Telegram — повторно не запоминаем (отметка на телефоне)", !calls(srv, "tg_auth_bind").length
    && (await a.page.evaluate(() => localStorage.getItem("sa_tg_bound"))) === TG_ANNA + "|" + tok(ANNA).slice(-12));
  await shot(a.page, "tg-in");
  // «Выйти с этого устройства» → tg_auth_off, экран входа без попытки
  await nav(a.page, "profile", 1500);
  await a.page.getByText("Выйти с этого устройства").first().click(); await sleep(400);
  await a.page.getByRole("button", { name: "Выйти", exact: true }).click();
  ok("TGLOGIN: вышла — tg_auth_off", await until(async () => !!lastCall(srv, "tg_auth_off"), 5000));
  ok("TGLOGIN: экран входа — поле кода, без «Узнаю тебя…»", await until(async () => /Введи код доступа/.test(await body(a.page)) && (await a.page.locator("[data-tg-login='try']").count()) === 0, 6000));
  ok("TGLOGIN: на сервере этот Telegram больше не входит без кода", srv.rpc("tg_login", { p_init_data: init }).error === "not_linked");
  // незнакомый Telegram
  const b = await open({ who: ANNA, srv, login: false, tg: { init: initOf(1), id: 1 } });
  ok("TGLOGIN: незнакомый Telegram — подсказка «Войди по коду один раз…» и поле кода", await until(async () => /Войди по коду один раз, дальше приложение будет узнавать тебя по Telegram\./.test(await txt(b.page.locator("[data-tg-login-note]"))), 8000)
    && /Введи код доступа/.test(await body(b.page)));
  await shot(b.page, "tg-unknown");
  // ссылка-приглашение (код в start_param): вход по коду, код подставлен, без попытки по Telegram
  const nTg = calls(srv, "tg_login").length;
  const c = await open({ who: ANNA, srv, login: false, tg: { init: initOf(TG_ANNA), id: TG_ANNA, start: Buffer.from("ABCD-2345").toString("base64").replace(/=+$/, "") } });
  await until(async () => /Введи код доступа/.test(await body(c.page)), 6000);
  ok("TGLOGIN: по ссылке-приглашению — код подставлен, без попытки по Telegram", (await c.page.locator("[data-tg-login='try']").count()) === 0 && calls(srv, "tg_login").length === nTg
    && (await c.page.locator("input").first().inputValue()) === "ABCD-2345", await c.page.locator("input").first().inputValue().catch(() => ""));
  // кнопка бота (start_param go_…) без входа — узнаём по Telegram, код не подставляется
  const s3 = newServer();
  const g = await open({ who: ANNA, srv: s3, login: false, tg: { init: initOf(TG_ANNA), id: TG_ANNA, start: "go_shift" } });
  ok("TGLOGIN: по кнопке бота (go_shift) без входа — вход по Telegram и сразу «Смена»", await until(async () => !!lastCall(s3, "tg_login") && /Опаздываю Предупредить руководителя/.test(await body(g.page)), 9000), (await body(g.page)).slice(0, 160));
  // старая сессия (вход по коду до v99), открыла в Telegram — этот Telegram запоминается
  const s4 = newServer();
  const e = await open({ who: ANNA, srv: s4, tg: { init: initOf(TG_ANNA), id: TG_ANNA } });
  ok("TGLOGIN: вход был раньше, открыла в Telegram — tg_auth_bind с её токеном", await until(async () => { const x = lastCall(s4, "tg_auth_bind"); return !!x && x.body.p_token === tok(ANNA); }, 6000));
  // вход по коду в Telegram — запоминается
  const s2 = newServer();
  const d = await open({ who: ANNA, srv: s2, login: false, tg: { init: initOf(42), id: 42 },
    rpcs: (fn) => (fn === "redeem_code" ? { ok: true, token: tok(ANNA), employee: ANNA } : undefined) });
  await until(async () => /Введи код доступа/.test(await body(d.page)), 8000);
  await d.page.locator("input").first().fill("ABCD2345"); await sleep(200);
  await d.page.getByRole("button", { name: /Войти/ }).first().click();
  ok("TGLOGIN: вошла по коду в Telegram — этот Telegram запомнен (tg_auth_bind)", await until(async () => { const x = lastCall(s2, "tg_auth_bind"); return !!x && x.body.p_token === tok(ANNA); }, 6000));
  const [e1, e2] = noErr(a, b, c, d, e, g);
  ok("TGLOGIN: без ошибок в консоли", e1, e2);
  for (const x of [a, b, c, d, e, g]) await x.ctx.close();
});

// ── GUIDE: гид ──
await run("GUIDE", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "guide", 1500);
  const t = await body(a.page);
  ok("GUIDE: у Анны — «Упоминания, поиск и черновики», «Опаздываю», «Смены в календаре телефона», «Вход через Telegram»",
    /Упоминания, поиск и черновики/.test(t) && /Опаздываю/.test(t) && /Смены в календаре телефона/.test(t) && /Вход через Telegram/.test(t));
  ok("GUIDE: у Анны пункта «Сервер» нет", !(await a.page.getByText("Сервер", { exact: true }).count()));
  await a.page.getByText("Опаздываю", { exact: true }).first().click(); await sleep(400);
  ok("GUIDE: «Опаздываю» раскрывается, «Открыть ›» ведёт в «Смену»", /За 3 часа до смены по графику/.test(await body(a.page)));
  await a.page.getByText("Открыть ›").first().click(); await sleep(1200);
  ok("GUIDE: «Открыть ›» — вкладка «Смена»", /Опаздываю Предупредить руководителя/.test(await body(a.page)));
  const r = await open({ who: ROMAN, srv });
  await nav(r.page, "guide", 1500);
  await r.page.getByText("Сервер", { exact: true }).first().click(); await sleep(400);
  await r.page.getByText("Открыть ›").first().click();
  ok("GUIDE: у владельца «Сервер» → экран «Сервер»", await until(async () => (await r.page.locator("[data-server]").count()) === 1, 5000));
  const [e1, e2] = noErr(a, r);
  ok("GUIDE: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await r.ctx.close();
});

// ── NARROW: 320 px, светлая тема ──
await run("NARROW", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv, light: true, w: 320, h: 640 });
  await until(async () => /Опаздываю\?/.test(await body(a.page)), 6000);
  let f = await fits(a.page);
  ok("NARROW: главная с «Опаздываю?» помещается", f.ok, JSON.stringify(f.over));
  await shot(a.page, "narrow-home");
  await a.page.getByText("Опаздываю?").first().click();
  await until(async () => (await a.page.locator("[data-chat-latesheet]").count()) === 1, 6000);
  f = await fits(a.page);
  ok("NARROW: лист «Опаздываю» помещается", f.ok, JSON.stringify(f.over));
  await shot(a.page, "narrow-late");
  await a.page.locator("[data-chat-latesheet] [data-sa-back], [data-chat-latesheet] .ch-x, [data-chat-latesheet] [aria-label='Закрыть']").first().click({ timeout: 3000 }).catch(() => a.page.keyboard.press("Escape"));
  await sleep(500);
  await input(a.page).click(); await input(a.page).type("@", { delay: 30 });
  await until(async () => (await a.page.locator("[data-chat-mentions]").count()) === 1, 3000);
  f = await fits(a.page);
  ok("NARROW: подсказки «@» помещаются", f.ok, JSON.stringify(f.over));
  await shot(a.page, "narrow-mention");
  await input(a.page).fill("");
  await toList(a.page);
  await a.page.locator("[data-chat-searchbtn]").click(); await sleep(400);
  await a.page.locator("[data-chat-q]").fill("банкет"); await until(async () => (await a.page.locator("[data-chat-sr]").count()) >= 1, 4000);
  f = await fits(a.page);
  ok("NARROW: поиск помещается", f.ok, JSON.stringify(f.over));
  await shot(a.page, "narrow-search");
  await chatClose(a.page);
  await nav(a.page, "shift", 1500);
  await a.page.getByText("Смены в календаре телефона").first().click();
  await until(async () => (await a.page.locator("[data-cal-sheet='ready']").count()) === 1, 5000);
  f = await fits(a.page);
  ok("NARROW: лист календаря помещается", f.ok, JSON.stringify(f.over));
  await shot(a.page, "narrow-cal");
  const r = await open({ who: ROMAN, srv, light: true, w: 320, h: 640 });
  await nav(r.page, "server", 2500);
  f = await fits(r.page);
  ok("NARROW: «Сервер» помещается", f.ok, JSON.stringify(f.over));
  await shot(r.page, "narrow-server");
  const [e1, e2] = noErr(a, r);
  ok("NARROW: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await r.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((x) => x.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
