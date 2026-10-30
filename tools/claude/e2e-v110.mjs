// e2e v110 (Доп. 423): порядок и минимализм. Владелец (30.10) после разбора новых экранов взял все четыре блока и попросил вкладки
// одним видом. Сервер — tools/claude/demo-app/fake-server.js (как e2e-v107: график, новички, памятка, собеседования). Разделы:
//   HUBS    — «Смена», «Команда», «Я»: группы — кнопками (свёрнуты, разделы одной строкой, непрочитанные — числом на значке);
//             нажал — развернулась строками, ещё раз — свернулась; что открыто, помнится; группа из одного раздела — сам раздел;
//             на компьютере — плитки;
//   NBHERO  — новичку в «Смене» «Первая неделя» карточкой с прогрессом («сделано 1 из 12», первая смена), без группы с одним пунктом;
//   MORNING — «Утро руководителя»: у строк значки по смыслу (смена, брифинг, стоп-лист…), «!» на кружке; «Не хватает …» и день под ним;
//   NEWBIES — сначала новички, памятка внизу одной строкой; карточка: темы плашками «45 из 100», «План недели»; «Ты вывела…» без
//             черты сверху; поиск по имени в листе «Наставник»;
//   WEEK    — «Первая неделя»: шаги строками в одной карточке на раздел, раздел «сейчас»; у Тимура одна «Написать»;
//   PEER    — «Спасибо от коллег»: крупно за неделю и очки, «За месяц · всего»; кружок с инициалами; без «спасибо» — без нулей;
//             свой значок в «Я»; сноска листа «Спасибо коллеге» в одну строку;
//   GAIN    — «Что дало обучение»: главное одной строкой, разница цифрой, кружки с инициалами — как lib/gain.js;
//   PAPER   — «Для чтения»; NARROW — 320 px без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v110.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v110";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v110";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { dLong, upFirst } = await import(SRC + "/lib/morning.js");
const G = await import(SRC + "/lib/gain.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

// ── дни: как в телефоне (Камчатка); в конце месяца — на две недели раньше (как e2e-v106, v107) ──
const TZ = "Asia/Kamchatka";
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const REAL = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const DIM = new Date(Date.UTC(+REAL.slice(0, 4), +REAL.slice(5, 7), 0)).getUTCDate();
const SHIFT_MS = (+REAL.slice(8, 10) + 13 > DIM ? -14 : 0) * 86400e3;
const TODAY = addD(REAL, SHIFT_MS / 86400e3);

const R0 = "Два моря, Океан";
const P = (id, name, surname, position, x = {}) => ({ id, name, surname, restaurant: R0, position, is_admin: false, ...x });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter");
const PETR = P("e-petr", "Пётр", "Орлов", "waiter"), VERA = P("e-vera", "Вера", "Соколова", "waiter"), DARYA = P("e-darya", "Дарья", "Лебедева", "waiter"), ILYA = P("e-ilya", "Илья", "Белов", "bartender");
const KSENIA = P("e-ksenia", "Ксения", "Миронова", "waiter"), TIMUR = P("e-timur", "Тимур", "Ахметов", "bartender"), ROMAN = P("u-roman", "Роман", "", "owner", { is_admin: true });
const PEOPLE = [MARIA, OLGA, ANNA, PETR, VERA, DARYA, ILYA, KSENIA, TIMUR, ROMAN];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 }, { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 },
  { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 }, { id: 8, name: "Миронова Ксения", pos: "waiter", norm: 160 }, { id: 9, name: "Ахметов Тимур", pos: "bar", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } }, split: {},
  rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: { waiter: { pattern: "even" } }, dayShift: "Д", staff: SSTAFF };
const NEAR = { 3: "ДД-ВВ--ДД-ВВ--", 4: "В-ДД-ВВ-ДД-ВВ-", 5: "-ВВ-ДД-В-ДД-ВВ", 6: "Д--Д--Д-В--Д-Д" };
function planOf() {
  const out = {};
  for (let i = -31; i <= 45; i++) {
    const set = (sid, k) => { if (k && k !== "-") (out[sid] = out[sid] || {})[i] = k; };
    const c2 = ((i % 4) + 4) % 4;
    set(1, c2 < 2 ? "Д" : ""); set(2, c2 >= 2 ? "Д" : ""); set(7, c2 === 1 || c2 === 2 ? "В" : "");
    for (const sid of [3, 4, 5, 6]) { const row = NEAR[sid]; set(sid, i >= 0 && i < row.length ? row[i] : row[((i % row.length) + row.length) % row.length]); }
    if (i >= 1) set(8, i % 3 === 0 ? "" : "Д");          // Ксения: первая смена завтра, «День» 12–20
    if (i >= -5) set(9, (i + 5) % 3 === 2 ? "" : "В");   // Тимур: первая смена пять дней назад, «Вечер» 16–24
  }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0]));
MENU.filter((d) => d && d.name && d.kind !== "cocktail").slice(3, 5).forEach((d) => Object.assign(d, { stop: { since: Date.now() - 3600e3, by: "Мария Ким" }, stopAt: Date.now() - 3600e3 }));
const MEMO = { addr: "Служебный вход со двора", arrive: 15, dress: "Чёрный верх, тёмные брюки", meet: "", extra: "Обед для команды в 15:30" };
const CANDS = [{ id: 501, name: "Ксения Миронова", at: -6, decision: "hire", aiScores: { "Сервис и гость": 78, "Конфликты и сложные ситуации": 45, "Честность и деньги": 62, "Команда": 85 } }];
// Ольга — новичок, которого Мария вывела на самостоятельную смену месяц назад («Ты вывела…»)
const NEWBIES = [{ emp: "e-ksenia", started: -1, checked: ["d1c"] },
  { emp: "e-timur", started: -6, buddy: "e-ilya", buddyBy: "u-maria", checked: ["d1a", "d1b"], confirm: { d2c: { by: "e-ilya", name: "Илья Белов", at: -2 } } },
  { emp: "e-olga", started: -45, solo: -34, buddy: "u-maria", buddyBy: "u-maria" }];
// занятия и тесты через день за два с лишним месяца — итог есть в любом месяце
const ACTIVITY = {}, QUIZ = [];
for (let i = -1; i >= -70; i--) {
  if (i % 2 === 0) (ACTIVITY["e-anna"] = ACTIVITY["e-anna"] || {})[i] = { st: 3, l: 2, q: 1 };
  if (i % 3 === 0) (ACTIVITY["e-petr"] = ACTIVITY["e-petr"] || {})[i] = { st: 2, l: 1, q: 1 };
  if (i > -30 && i % 2 === 0) QUIZ.push({ emp: "e-anna", lesson: "s4-q", at: i, n: 4, w: i % 4 === 0 ? 1 : 0 });
  if (i <= -30 && i % 2 === 0) QUIZ.push({ emp: "e-anna", lesson: "s4-q", at: i, n: 4, w: 1 });
}
const THANKS = [-1, -2, -3, -5, -8, -12, -20, -33, -40].map((at, i) => ({ emp: i % 2 ? "e-anna" : "e-petr", at, time: "20:10", text: i % 3 ? "Спасибо за вечер" : "" }));
const PEER = [{ from: "u-maria", to: "e-anna", text: "выручила с банкетом на веранде", at: -1, time: "21:50", plus: ["e-petr"] }];
function srvOf() {
  const pings = [];
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU,
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"] },
    tgLinked: ["u-maria", "e-anna", "e-ksenia", "e-petr"], newbies: NEWBIES, nbMemo: MEMO, cands: CANDS, cheers: false,
    activity: ACTIVITY, quiz: QUIZ, thanks: THANKS, peerThanks: PEER, learn: { "e-anna": [-1, -2], "u-maria": [-1], "e-petr": [-12] },
    ping: (to, text) => pings.push({ to, text }) });
  s.calls = []; s.pings = pings;
  s.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут.");
  for (const k of Object.keys(s.S.seen)) delete s.S.seen[k];
  return s;
}

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = MARIA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, mobile = true, path = "/", seedExtra = {}, fold = false } = {}) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce" });
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
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: MENU }), sa_boot_missing: String(Date.now() + SHIFT_MS),
    ...(fold ? {} : { sa_hub_open: "all" }), ...seedExtra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  const page = await ctx.newPage();
  if (SHIFT_MS) await page.clock.install({ time: Date.now() + SHIFT_MS });
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
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !e.closest("[data-nb-sheet]") && !e.closest("[data-chat]"); }).map((e) => (typeof e.className === "string" && e.className ? e.className.slice(0, 40) : e.tagName)); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const hubItem = (page, label) => page.locator(`.sa-card[aria-label="${label}"]`).first();
// группы вкладки: заголовок и сколько из них — строками в одной карточке
const hubShape = (page) => page.evaluate(() => {
  const groups = [...document.querySelectorAll("[data-hub-group]")].map((g) => g.getAttribute("data-hub-group"));
  const compact = [...document.querySelectorAll("[data-hub-compact]")].map((c) => [...c.querySelectorAll(".sa-card[aria-label]")].map((x) => x.getAttribute("aria-label")));
  // карточки-пункты вне строк (живые карточки сверху — без aria-label пункта, кроме «Первой недели»)
  const loose = [...document.querySelectorAll(".sa-card.sa-pagein[aria-label]")].filter((e) => !e.closest("[data-hub-compact]") && !e.hasAttribute("data-nb-hero")).map((e) => e.getAttribute("aria-label"));
  return { groups, compact, loose, tiles: !!document.querySelector(".sa-hubtiles") };
});
const groupsOf = (page) => page.evaluate(() => [...document.querySelectorAll("[data-hub-group]")].map((g) => ({ name: g.getAttribute("data-hub-group"), open: g.getAttribute("data-hub-open") === "1" ? 1 : 0,
  single: g.hasAttribute("data-hub-single"), preview: (g.querySelector("[data-hub-preview]") || {}).textContent || "", badge: (g.querySelector("[data-hub-badge]") || { getAttribute: () => "" }).getAttribute("data-hub-badge") || "" })));
const ready = (page, attr) => until(() => page.locator(`[${attr}="ready"], [${attr}="ok"]`).count(), 9000);

await run("HUBS", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, fold: true });
  await nav(m.page, "shift", 1800);
  await until(() => m.page.locator("[data-hub-toggle]").count(), 6000);
  await until(() => m.page.locator('[data-hub-group="На смене"] [data-hub-badge]').count(), 9000);   // непрочитанные в чате приходят чуть позже
  const st = await groupsOf(m.page);
  const unread = srv.rpc("chat_unread", { p_token: tok(MARIA) });
  ok("HUBS: «Смена» — кнопки «На смене» и «Потренироваться», свёрнуты; строк нет", st.map((g) => g.name + ":" + g.open).join(",") === "На смене:0,Потренироваться:0"
    && !(await m.page.locator("[data-hub-compact]").count()), JSON.stringify(st));
  ok("HUBS: на кнопке — разделы одной строкой: «Утро руководителя · Опаздываю · Брифинг смены…»", st[0].preview.startsWith("Утро руководителя · Опаздываю · Брифинг смены · Чат смены"), st[0].preview);
  ok("HUBS: непрочитанные в чате — числом на значке свёрнутой «На смене»", /^\d+$/.test(st[0].badge) && Number(st[0].badge) > 0, JSON.stringify(st[0]) + " " + JSON.stringify(unread).slice(0, 80));
  await shot(m.page, "hub-shift-folded");
  await m.page.locator('[data-hub-toggle="На смене"]').click(); await sleep(600);
  const st2 = await groupsOf(m.page);
  const rows = await m.page.evaluate(() => [...document.querySelectorAll('[data-hub-group="На смене"] [data-hub-compact] .sa-card[aria-label]')].map((e) => e.getAttribute("aria-label")));
  ok("HUBS: нажал «На смене» — развернулась строками (Утро руководителя, Опаздываю, Брифинг, Чат, График, Чек-листы…); счётчик — в строке чата", st2[0].open === 1 && !st2[0].badge
    && rows.slice(0, 6).join(",") === "Утро руководителя,Опаздываю,Брифинг смены,Чат смены,График,Чек-листы" && /\d+$/.test(await txt(hubItem(m.page, "Чат смены"))), rows.join(","));
  ok("HUBS: стрелка — вверх, aria-expanded", (await m.page.locator('[data-hub-toggle="На смене"]').getAttribute("aria-expanded")) === "true");
  await shot(m.page, "hub-shift-open");
  const one = await m.page.evaluate(() => [...document.querySelectorAll("[data-hub-compact] .sa-card")].every((r) => { const s = r.querySelector("div > div + div"); return !s || getComputedStyle(s).whiteSpace === "nowrap"; }));
  ok("HUBS: подписи строк — в одну строку", one);
  await m.page.reload({ waitUntil: "load" }); await sleep(1500);
  await nav(m.page, "shift", 1500);
  const st3 = await groupsOf(m.page);
  ok("HUBS: снова открыл приложение — «На смене» открыта, «Потренироваться» свёрнута (помнится)", st3.map((g) => g.name + ":" + g.open).join(",") === "На смене:1,Потренироваться:0",
    JSON.stringify(st3));
  await m.page.locator('[data-hub-toggle="На смене"]').click(); await sleep(500);
  const saved = await m.page.evaluate(() => localStorage.getItem("sa_hub_open"));
  ok("HUBS: нажал ещё раз — свернулась", (await groupsOf(m.page))[0].open === 0 && JSON.parse(saved).shift.length === 0, saved);
  await nav(m.page, "teamHub", 1600);
  const tm = await groupsOf(m.page);
  ok("HUBS: «Команда» — кнопки «Управление» и «Команда»; «Работа над ошибками» (одна в группе) — сразу разделом", tm.map((g) => g.name + (g.single ? "*" : "")).join(",") === "Управление,Команда,Моё обучение*"
    && (await m.page.locator('[data-hub-single] .sa-card[aria-label="Работа над ошибками"]').count()) === 1, JSON.stringify(tm));
  await shot(m.page, "hub-team-folded");
  await nav(m.page, "me", 1600);
  const me = await groupsOf(m.page);
  ok("HUBS: «Я» — «Мой путь», «Итоги и документы», «Свеча на двоих» разделом, «Помощь и настройки»", me.map((g) => g.name + (g.single ? "*" : "")).join(",") === "Мой путь,Итоги и документы,Вместе*,Помощь и настройки"
    && (await m.page.locator('[data-hub-single] .sa-card[aria-label="Свеча на двоих"]').count()) === 1, JSON.stringify(me));
  await shot(m.page, "hub-me-folded");
  const d = await open({ who: MARIA, srv, w: 1280, h: 860, mobile: false, fold: true });
  await nav(d.page, "shift", 1800);
  const dk = await hubShape(d.page);
  ok("HUBS: на компьютере — плитки, как раньше (без кнопок-групп)", dk.tiles && !dk.compact.length && !(await d.page.locator("[data-hub-toggle]").count()), JSON.stringify(dk));
  const [e1, e2] = noErr(m, d); ok("HUBS: без ошибок", e1, e2);
  await m.ctx.close(); await d.ctx.close();
});

await run("NBHERO", async () => {
  const srv = srvOf();
  const k = await open({ who: KSENIA, srv });
  await nav(k.page, "shift", 1600);
  const hero = k.page.locator("[data-nb-hero]");
  await until(() => hero.count(), 6000);
  const t = await txt(hero);
  ok("NBHERO: новичку в «Смене» — карточка «Первая неделя»: «сделано 1 из 12», «Первая смена: завтра, 12:00»", /^Первая неделя сделано 1 из 12 Первая смена: завтра, 12:00/.test(t), t);
  const groups = await k.page.evaluate(() => [...document.querySelectorAll("[data-hub-group]")].map((g) => g.getAttribute("data-hub-group")));
  ok("NBHERO: группы «Первая неделя» с одним пунктом больше нет", !groups.includes("Первая неделя"), groups.join(","));
  ok("NBHERO: прогресс — полоска 1 из 12 (8%)", await k.page.evaluate(() => { const b = document.querySelector("[data-nb-hero] [aria-hidden] > div"); return !!b && b.style.width === "8%"; }));
  await shot(k.page, "nbhero");
  await hero.click();
  ok("NBHERO: нажатие — «Первая неделя»", await until(() => k.page.locator('[data-newbie="ready"]').count(), 9000));
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "shift", 1600);
  ok("NBHERO: не новичку — карточки нет", (await until(async () => (await a.page.locator("[data-hub-compact]").count()) > 0, 6000)) && !(await a.page.locator("[data-nb-hero]").count()));
  const [e1, e2] = noErr(k, a); ok("NBHERO: без ошибок", e1, e2);
  await k.ctx.close(); await a.ctx.close();
});

await run("MORNING", async () => {
  const srv = srvOf();
  // на неделе — две нехватки людей (график демо их не даёт): строки «Не хватает …» с днём под ними
  const withHoles = (fn, b) => (fn === "morning_brief" ? ((r) => ({ ...r, holes: [...(r.holes || []), { day: addD(TODAY, 2), pos: "waiter", miss: 1 }, { day: addD(TODAY, 4), pos: "bartender", miss: 1 }] }))(srv.rpc(fn, b)) : undefined);
  const m = await open({ who: MARIA, srv, rpcs: withHoles });
  await nav(m.page, "morning", 1500);
  await ready(m.page, "data-morning"); await sleep(400);
  const g = await m.page.evaluate(() => [...document.querySelectorAll("[data-mo-row]")].map((r) => { const s = r.querySelector("[data-glyph]"); return r.getAttribute("data-mo-row") + ":" + (s ? s.getAttribute("data-glyph") + "/" + s.getAttribute("data-glyph-kind") : "-"); }));
  const of = (k) => (g.find((x) => x.startsWith(k + ":")) || "").split(":")[1] || "";
  const sh = g.filter((x) => x.startsWith("sh-"));
  ok("MORNING: смены — солнце (день) и луна (вечер), брифинг не собран — значок брифинга с «!», стоп-лист — свой знак",
    sh.length >= 1 && sh.every((x) => /:(sun|moon)\/info$/.test(x)) && of("brief") === "brief/warn" && of("stop") === "stop/info", g.join(" "));
  ok("MORNING: у каждой строки — значок по смыслу (нет пустых кружков с точкой)", g.every((x) => !/:-$/.test(x) && !/:\//.test(x)), g.join(" "));
  const holes = await m.page.evaluate(() => [...document.querySelectorAll('[data-mo-row^="hole-2"]')].map((r) => [r.getAttribute("data-mo-row").slice(5), r.innerText.replace(/\s+/g, " ").trim()]));
  ok("MORNING: «На неделе» — «Не хватает …», под ним день словами", holes.length > 0 && holes.every(([d, t]) => t.startsWith("Не хватает ") && t.includes(upFirst(dLong(d)))), JSON.stringify(holes));
  await shot(m.page, "morning");
  const [e1, e2] = noErr(m); ok("MORNING: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("NEWBIES", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "newbies", 1500);
  await ready(m.page, "data-newbies"); await sleep(300);
  const hs = await m.page.evaluate(() => [...document.querySelectorAll("[data-nb-h]")].map((e) => e.getAttribute("data-nb-h")));
  ok("NEWBIES: сначала новички, потом «Ты вывела…», памятка внизу", hs.join(",") === "list,led,memo", hs.join(","));
  ok("NEWBIES: памятка — «Приходить за 15 минут до смены», остальное строкой, «Изменить»", (await txt(m.page.locator("[data-nbl-memo-arrive]"))) === "Приходить за 15 минут до смены"
    && /Служебный вход со двора · Чёрный верх, тёмные брюки · встретит наставник или менеджер смены · Обед для команды в 15:30/.test(await txt(m.page.locator("[data-nbl-memo-rest]")))
    && (await m.page.locator("[data-nbl-memo-edit]").count()) === 1);
  const ks = await txt(m.page.locator('[data-nbl-item="e-ksenia"]'));
  ok("NEWBIES: Ксения — «слабые темы:» плашками «конфликты и сложные ситуации 45 из 100», «честность и деньги 62 из 100», «План недели 1 из 12»",
    /слабые темы:/.test(ks) && (await m.page.locator('[data-nbl-item="e-ksenia"] [data-nbl-focus] span').allInnerTexts()).join("|") === "конфликты и сложные ситуации 45 из 100|честность и деньги 62 из 100"
    && /План недели 1 из 12/.test(ks), ks);
  const w = await m.page.evaluate(() => { const c = document.querySelector('[data-nbl-item="e-ksenia"]'), f = c && c.querySelector("[data-nbl-first]"); return c && f ? Math.round(f.getBoundingClientRect().left - c.getBoundingClientRect().left) : -1; });
  ok("NEWBIES: подробности — на всю ширину карточки (от левого края, не под аватаркой)", w >= 0 && w <= 20, "отступ " + w);
  const led = await m.page.evaluate(() => { const r = document.querySelector("[data-nbl-led] [data-nb-line]"); return r ? getComputedStyle(r).borderTopWidth : "нет"; });
  ok("NEWBIES: «Ты вывела на самостоятельную смену» — Ольга Л., без черты над первой строкой", /Ольга Л\./.test(await txt(m.page.locator("[data-nbl-led]"))) && led === "0px", led);
  const gap = await m.page.evaluate(() => { const a = document.querySelector("[data-nbl-add]"), hd = document.querySelector('[data-nb-h="led"]'); return a && hd ? Math.round(hd.getBoundingClientRect().top - a.getBoundingClientRect().bottom) : -1; });
  ok("NEWBIES: заголовок не прилипает к «Добавить новичка из команды»", gap >= 14, "зазор " + gap);
  await shot(m.page, "newbies");
  await m.page.locator('[data-nbl-item="e-ksenia"] [role=button]').first().click(); await sleep(600);
  await m.page.locator('[data-nbl-buddy="e-ksenia"]').click(); await sleep(700);
  ok("NEWBIES: лист «Наставник» — поиск по имени", (await m.page.locator('[data-nb-sheet="buddy"] [data-nb-search]').count()) === 1);
  await m.page.locator("[data-nb-search]").fill("ве"); await sleep(300);
  const keys = await m.page.evaluate(() => [...document.querySelectorAll('[data-nb-sheet="buddy"] [data-nb-pick]')].map((e) => e.getAttribute("data-nb-pick")));
  ok("NEWBIES: «ве» — одна Вера", keys.join(",") === "e-vera", keys.join(","));
  await m.page.locator("[data-nb-search]").fill("щщ"); await sleep(300);
  ok("NEWBIES: никого — «Никого с таким именем.»", (await txt(m.page.locator('[data-nb-sheet="buddy"] [data-nb-none]'))) === "Никого с таким именем.");
  await shot(m.page, "buddy-search");
  const [e1, e2] = noErr(m); ok("NEWBIES: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("WEEK", async () => {
  const srv = srvOf();
  const k = await open({ who: KSENIA, srv });
  await nav(k.page, "newbie", 1500);
  await ready(k.page, "data-newbie"); await sleep(300);
  const box = await k.page.evaluate(() => [...document.querySelectorAll("[data-nb-sec]")].filter((s) => s.querySelector("[data-nb-step]")).map((s) => {
    const steps = [...s.querySelectorAll("[data-nb-step]")]; return s.getAttribute("data-nb-sec") + ":" + steps.length + ":" + new Set(steps.map((x) => x.parentElement)).size; }));
  ok("WEEK: шаги — строками в одной карточке на раздел (с собеседования, день 1, дни 2–3, к концу недели)", box.join(" ") === "focus:2:1 d1:4:1 d2:4:1 d3:2:1", box.join(" "));
  ok("WEEK: первая смена завтра — «сейчас» у тем с собеседования", (await k.page.locator('[data-nb-now="1"]').getAttribute("data-nb-sec")) === "focus"
    && /сейчас/.test(await txt(k.page.locator('[data-nb-sec-h="focus"]'))));
  const ring = await k.page.evaluate(() => { const s = document.querySelector('[data-nb-step="d1a"] > span'); return s ? getComputedStyle(s).borderTopColor : ""; });
  ok("WEEK: пустой кружок шага — золотым ободком", /rgba\(217, 184, 124/.test(ring), ring);
  await k.page.locator('[data-nb-step="d1a"]').click(); await sleep(800);
  ok("WEEK: отметка шага — как раньше (на сервере)", !!srv.S.nb["e-ksenia"].checked.d1a && (await k.page.locator('[data-nb-step="d1a"]').getAttribute("data-nb-done")) === "1");
  await shot(k.page, "week");
  const t = await open({ who: TIMUR, srv });
  await nav(t.page, "newbie", 1500);
  await ready(t.page, "data-newbie"); await sleep(300);
  ok("WEEK: у Тимура (неделя с первой смены) «сейчас» — «К концу недели»; «Написать» наставнику одна", (await t.page.locator('[data-nb-now="1"]').getAttribute("data-nb-sec")) === "d3"
    && (await t.page.locator("[data-nb-dm]").count()) === 1);
  const [e1, e2] = noErr(k, t); ok("WEEK: без ошибок", e1, e2);
  await k.ctx.close(); await t.ctx.close();
});

await run("PEER", async () => {
  const srv = srvOf();
  const tp = srv.rpc("thanks_peer", { p_token: tok(ANNA) });
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "me", 1500);
  await until(async () => (await hubItem(a.page, "Спасибо от коллег").count()) > 0, 6000);
  // свой значок: сердце в облачке чата, а не сердце с галочкой, как у «Спасибо от гостей»
  const ic = await a.page.evaluate(() => { const p = document.querySelector('.sa-card[aria-label="Спасибо от коллег"] [data-hub-ic] svg'); return p ? p.innerHTML : ""; });
  ok("PEER: в «Я» у «Спасибо от коллег» свой значок (сердце в облачке, не как у гостей)", ic.includes("5.5 4h13") && !ic.includes("M9.5 11.5l1.8 1.8 3.4-3.6"), ic.slice(0, 120));
  await hubItem(a.page, "Спасибо от коллег").click();
  await ready(a.page, "data-peer"); await sleep(300);
  const wk = Number(tp.week) || 0;
  ok("PEER: крупно — за неделю и сколько это очков, ниже «За месяц · всего»", (await a.page.locator(`[data-peer-week="${wk}"]`).count()) === 1
    && (await txt(a.page.locator("[data-peer-pts]"))) === (wk ? "+" + wk * 5 + " очков в «Сотруднике недели»" : "Каждое «спасибо» даёт 5 очков в «Сотруднике недели»")
    && (await txt(a.page.locator("[data-peer-more]"))) === "За месяц " + (tp.month || 0) + " · всего " + (tp.total || 0), JSON.stringify(tp).slice(0, 160));
  const it = await txt(a.page.locator("[data-peer-item]"));
  ok("PEER: карточка — кружок «МК», когда и кто, за что, «Ещё спасибо»", /^МК вчера · Мария К\. «Выручила с банкетом на веранде» Ещё спасибо: Пётр О\.$/i.test(it), it);
  await shot(a.page, "peer");
  const r = await open({ who: ROMAN, srv });
  await nav(r.page, "peerThanks", 1500);
  await ready(r.page, "data-peer"); await sleep(300);
  ok("PEER: «спасибо» ещё нет — без «0 0 0», пояснение и «Сказать спасибо коллеге»", !(await r.page.locator("[data-peer-stats]").count()) && (await r.page.locator("[data-peer-empty] [data-peer-say]").count()) === 1
    && /5 очков в «Сотруднике недели»/.test(await txt(r.page.locator("[data-peer-empty]"))));
  await shot(r.page, "peer-empty");
  // лист «Спасибо коллеге»: сноска в одну строку
  await a.page.evaluate(() => { const b = document.querySelector("[data-lens=back]"); if (b) b.click(); }); await sleep(800);
  await nav(a.page, "shift", 1200);
  await a.page.locator("[data-chat-disc]").first().click(); await sleep(1300);
  await a.page.locator('[data-chat-item="team"]').first().click(); await sleep(1600);
  await a.page.locator("[data-chat-attach]").click(); await sleep(700);
  await a.page.locator('[data-chat-act="thx"]').click(); await sleep(1200);
  await a.page.locator('[data-chat-thxsheet] [data-chat-person="e-petr"]').click(); await sleep(600);
  const hint = a.page.locator("[data-chat-thx-hint]");
  const lines = await hint.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || "18"))).catch(() => 0);
  ok("PEER: лист «Спасибо коллеге» — «Карточку увидит вся команда, коллеге +5 очков.» в одну строку", (await txt(hint)) === "Карточку увидит вся команда, коллеге +5 очков." && lines === 1, "строк " + lines);
  const [e1, e2] = noErr(a, r); ok("PEER: без ошибок", e1, e2);
  await a.ctx.close(); await r.ctx.close();
});

await run("GAIN", async () => {
  const srv = srvOf();
  const g = srv.rpc("gain_month", { p_token: tok(MARIA) });
  const md = G.gainModel(g), hd = G.gainHeadline(md);
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "gain", 1500);
  await ready(m.page, "data-gain"); await sleep(400);
  ok("GAIN: главное одной строкой — как lib/gain.js", hd.learn && (await txt(m.page.locator("[data-gain-head-learn]"))) === hd.learn
    && (hd.hall ? (await txt(m.page.locator("[data-gain-head-hall]"))) === hd.hall && (await m.page.locator(`[data-gain-head-hall="${hd.tone}"]`).count()) === 1 : !(await m.page.locator("[data-gain-head-hall]").count())),
    JSON.stringify(hd) + " · " + (await txt(m.page.locator("[data-gain-head]"))));
  const want = [...G.learnRows(md), ...G.hallRows(md)].filter((x) => G.deltaText(x)).map((x) => x.key + ":" + G.deltaText(x));
  const got = await m.page.evaluate(() => [...document.querySelectorAll("[data-gain-delta]")].map((e) => e.getAttribute("data-gain-delta") + ":" + e.innerText.trim()));
  ok("GAIN: разница цифрой у строк — как lib/gain.js", want.length > 0 && got.join(" ") === want.join(" "), got.join(" ") + " ≠ " + want.join(" "));
  const av = await m.page.evaluate(() => [...document.querySelectorAll("[data-gain-grew], [data-gain-idle]")].map((r) => (r.querySelector("span[aria-hidden]") || {}).textContent || ""));
  ok("GAIN: у «выросли» и «не занимались» — кружки с инициалами", (md.grew.length + md.idle.length) === av.length && av.every((x) => /^[А-ЯЁA-Z]{1,2}$/.test(x)), av.join(","));
  await shot(m.page, "gain");
  const [e1, e2] = noErr(m); ok("GAIN: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, light: true });
  await nav(m.page, "morning", 1500);
  await ready(m.page, "data-morning"); await sleep(300);
  const col = await m.page.evaluate(() => { const s = document.querySelector('[data-glyph-kind="warn"]'); return s ? getComputedStyle(s).borderTopColor : ""; });
  ok("PAPER: «Для чтения» — значок «нужно внимание» тёмно-янтарный", col === "rgb(139, 90, 18)", col);
  await shot(m.page, "paper-morning");
  await nav(m.page, "shift", 1500);
  const bg = await m.page.evaluate(() => { const c = document.querySelector("[data-hub-group]"); return c ? getComputedStyle(c).backgroundColor : ""; });
  ok("PAPER: строки вкладки — светлая карточка", /rgba\(250, 242, 222/.test(bg), bg);
  await shot(m.page, "paper-shift");
  await m.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, w: 320, h: 700 });
  const bad = [];
  for (const s of ["shift", "teamHub", "me", "newbies", "morning", "gain"]) {
    await nav(m.page, s, 1800);
    const f = await fits(m.page);
    if (f.sw > f.W || f.n) bad.push(s + ":" + JSON.stringify(f));
    if (s === "shift" || s === "newbies") await shot(m.page, "narrow-" + s);
  }
  ok("NARROW: 320 px — вкладки, «Новички», «Утро», «Что дало обучение» без сдвига вбок", !bad.length, bad.join(" | "));
  const k = await open({ who: KSENIA, srv, w: 320, h: 700, fold: true });
  await nav(k.page, "shift", 1600);
  await until(() => k.page.locator("[data-nb-hero]").count(), 6000);
  const f2 = await fits(k.page);
  ok("NARROW: «Первая неделя» в «Смене» — по ширине", f2.sw <= f2.W && !f2.n, JSON.stringify(f2));
  // кнопки-группы на 320 px: название не наезжает на значок со счётчиком и на стрелку
  const clash = await k.page.evaluate(() => [...document.querySelectorAll("[data-hub-toggle]")].map((b) => {
    const ic = b.querySelector("[data-hub-ic]").getBoundingClientRect(), nm = b.querySelector("[data-hub-name]").getBoundingClientRect(), ch = b.querySelector("svg.sa-hubchev").getBoundingClientRect();
    const bd = b.querySelector("[data-hub-badge]"), bb = bd ? bd.getBoundingClientRect() : null;
    return { g: b.getAttribute("data-hub-toggle"), ok: nm.left >= ic.right - 1 && nm.right <= ch.left + 1 && (!bb || bb.right <= nm.left + 1) };
  }));
  ok("NARROW: кнопки-группы — название, счётчик на значке и стрелка не наезжают друг на друга", clash.length >= 2 && clash.every((x) => x.ok), JSON.stringify(clash));
  await shot(k.page, "narrow-nbhero");
  await m.ctx.close(); await k.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
