// e2e v107 (Доп. 420): новичок. Владелец (29.10): «Вот эти» — старт с собеседования, тёплый вход, опытный ведёт новичка.
// Сервер — tools/claude/demo-app/fake-server.js (как у e2e-v106). Разделы:
//   HUB     — новичку во вкладке «Смена» первым пунктом «Первая неделя» (с первой сменой), остальным его нет; «Новички» во
//             вкладке «Команда» — руководителю и наставнику («Ты наставник: Тимур А.»), остальным нет;
//   WEEK    — «Первая неделя» Ксении: первая смена завтра с памяткой (к какому времени, как найти, форма, кто встретит),
//             наставника пока нет, темы с собеседования первыми (урок открывается), свои шаги отмечаются, шаг наставника — нет;
//   AUTO    — тема пройдена в уроках — шаг отмечен сам и ушёл на сервер;
//   TIMUR   — с наставником: «Написать» — личная переписка, «5 столов» подтверждено, первая смена уже была;
//   LEAD    — «Новички» у руководителя: памятка, новички с первой сменой, наставником и собеседованием; «Назначить» наставника —
//             команда видит «Знакомьтесь»; «Открыть «Вся команда»»;
//   CONFIRM — руководитель подтверждает самостоятельную смену: карточка в чате; «Снять» — карточка уходит;
//   MEMO    — памятка меняется и сразу видна новичку; CAND — собеседование: «Без собеседования», другое, «Найти само»;
//   ADD     — «Добавить новичка из команды» и «Убрать из новичков» (второе нажатие);
//   BUDDY   — наставник видит своих: «Встретить к …», темы для занятий, подтверждает, «Ты вывел на самостоятельную смену»;
//   CHAT    — карточки в «Вся команда»: «Поздороваться» и «Поздравить» один раз, новичок видит, кто поздоровался;
//   PERSON  — «Наставник новичков» в карточке коллеги; DEEP — ссылки бота ?go=newbie и ?go=newbies;
//   MISSING — этапа 41 нет: прежние пункты и прежний экран; PAPER — «Для чтения»; NARROW — 320 px без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v107.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5298, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v107";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v107";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { dLong, dShort } = await import(SRC + "/lib/morning.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

// ── дни: как в телефоне (Камчатка); в конце месяца — на две недели раньше (как e2e-v106) ──
const TZ = "Asia/Kamchatka";
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const REAL = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const DIM = new Date(Date.UTC(+REAL.slice(0, 4), +REAL.slice(5, 7), 0)).getUTCDate();
const SHIFT_MS = (+REAL.slice(8, 10) + 13 > DIM ? -14 : 0) * 86400e3;
const TODAY = addD(REAL, SHIFT_MS / 86400e3);
const D = (n) => addD(TODAY, n);
const dayMon = (iso) => dLong(iso).split(", ")[1];

const R0 = "Два моря, Океан";
const P = (id, name, surname, position) => ({ id, name, surname, restaurant: R0, position, is_admin: false });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter");
const PETR = P("e-petr", "Пётр", "Орлов", "waiter"), VERA = P("e-vera", "Вера", "Соколова", "waiter"), DARYA = P("e-darya", "Дарья", "Лебедева", "waiter"), ILYA = P("e-ilya", "Илья", "Белов", "bartender");
const KSENIA = P("e-ksenia", "Ксения", "Миронова", "waiter"), TIMUR = P("e-timur", "Тимур", "Ахметов", "bartender");
const PEOPLE = [MARIA, OLGA, ANNA, PETR, VERA, DARYA, ILYA, KSENIA, TIMUR];
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
    if (i >= 1) set(8, i % 3 === 0 ? "" : "Д");     // Ксения: первая смена завтра, «День» 12–20
    if (i >= -5) set(9, (i + 5) % 3 === 2 ? "" : "В");   // Тимур: первая смена пять дней назад, «Вечер» 16–24
  }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0]));
const MEMO = { addr: "Служебный вход со двора", arrive: 15, dress: "Чёрный верх, тёмные брюки", meet: "", extra: "Обед для команды в 15:30" };
const CANDS = [{ id: 501, name: "Ксения Миронова", at: -6, decision: "hire", aiScores: { "Сервис и гость": 78, "Конфликты и сложные ситуации": 45, "Честность и деньги": 62, "Команда": 85 } },
  { id: 502, name: "Глеб Соколов", at: -2, decision: "hire", topics: [{ topic: "Сервис и гость", ok: 1, n: 3 }, { topic: "Команда", ok: 2, n: 2 }] }];
const NEWBIES = () => [{ emp: "e-ksenia", started: -1, checked: ["d1c"] },
  { emp: "e-timur", started: -6, buddy: "e-ilya", buddyBy: "u-maria", checked: ["d1a", "d1b"], confirm: { d2c: { by: "e-ilya", name: "Илья Белов", at: -2 } } }];
function srvOf({ newbies = NEWBIES(), progress = {}, quizzes = {}, hello = false, memo = MEMO } = {}) {
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU,
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"], ...progress }, quizzes,
    tgLinked: ["u-maria", "e-anna", "e-ksenia"], newbies, nbMemo: memo, cands: CANDS });
  s.calls = [];
  s.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут.");
  s.bot.say("e-anna", "Возьму веранду сегодня.");
  if (hello) s.hello = s.rpc("newbie_set", { p_token: "tok-u-maria", p_emp: "e-ksenia", p_hello: true }).msg;
  return s;
}

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = ANNA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, path = "/", seedExtra = {} } = {}) {
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
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: MENU }), sa_boot_missing: String(Date.now() + SHIFT_MS), ...seedExtra };
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
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !e.closest("[data-nb-sheet]"); }).map((e) => (typeof e.className === "string" && e.className ? e.className.slice(0, 40) : e.tagName)); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
const sheetFits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth, d = document.querySelector("[data-nb-sheet] [role=dialog]"); if (!d) return { none: true }; const over = [...d.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; return { W, over, dw: Math.round(d.getBoundingClientRect().width) }; });
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const lastCall = (srv, fn) => [...srv.calls].reverse().find((c) => c.fn === fn) || null;
const card = (page, t) => page.locator(`[data-chat-card="${t}"]`).last();
const hubFirst = (page) => page.evaluate(() => { const c = [...document.querySelectorAll(".sa-card.sa-pagein[aria-label]")].filter((e) => e.getClientRects().length); return c.length ? c[0].getAttribute("aria-label") : ""; });
const hubItem = (page, label) => page.locator(`.sa-card[aria-label="${label}"]`).first();
const hubSub = async (page, label) => txt(hubItem(page, label));
const toWeek = async (page) => {
  await nav(page, "shift", 1400);
  await until(async () => (await hubItem(page, "Первая неделя").count()) > 0 && /Первая смена|План по дням/.test(await hubSub(page, "Первая неделя")), 6000);
  await hubItem(page, "Первая неделя").click();
  await until(() => page.locator('[data-newbie="ready"]').count(), 9000); await sleep(400);
};
const toList = async (page) => {
  await nav(page, "teamHub", 1400);
  await until(async () => (await hubItem(page, "Новички").count()) > 0 && !/План первой недели/.test(await hubSub(page, "Новички")), 6000);
  await hubItem(page, "Новички").click();
  await until(() => page.locator('[data-newbies="ready"]').count(), 9000); await sleep(400);
};
const step = (page, id) => page.locator(`[data-nb-step="${id}"]`);
const item = (page, emp) => page.locator(`[data-nbl-item="${emp}"]`);
const expand = async (page, emp) => { if (!(await page.locator(`[data-nbl-open="${emp}"]`).count())) { await item(page, emp).locator("[role=button]").first().click(); await sleep(500); } };
const pick = async (page, key) => { await page.locator(`[data-nb-pick="${key}"]`).click(); await sleep(900); };
const openTeam = async (page) => {
  await page.locator("[data-chat-disc]").first().click(); await sleep(1300);
  await page.locator('[data-chat-item="team"]').first().click(); await sleep(1500);
};
const F1 = "f:Конфликты и сложные ситуации", F2 = "f:Честность и деньги";
const luma = (rgb) => { const m = String(rgb).match(/\d+(\.\d+)?/g); if (!m) return 0; const [r, g, b] = m.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

await run("HUB", async () => {
  const srv = srvOf();
  const k = await open({ who: KSENIA, srv });
  await nav(k.page, "shift", 1400);
  await until(async () => /Первая смена: завтра/.test(await hubSub(k.page, "Первая неделя")), 6000);
  const f = await hubFirst(k.page);
  ok("HUB: новичку во вкладке «Смена» первым пунктом — «Первая неделя» с первой сменой", f === "Первая неделя" && /Первая смена: завтра, 12:00/.test(await hubSub(k.page, "Первая неделя")),
    f + " · " + (await hubSub(k.page, "Первая неделя")));
  await shot(k.page, "hub-ksenia");
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "shift", 1400);
  ok("HUB: не новичку (Анна) — «Первой недели» нет", await until(async () => !(await hubItem(a.page, "Первая неделя").count()), 6000));
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "teamHub", 1400);
  ok("HUB: руководителю во вкладке «Команда» — «Новички»: наставники, памятка и темы с собеседования",
    await until(async () => /Наставники, памятка и темы с собеседования/.test(await hubSub(m.page, "Новички")), 6000), await hubSub(m.page, "Новички"));
  const i = await open({ who: ILYA, srv });
  await nav(i.page, "teamHub", 1400);
  ok("HUB: наставнику (Илья) — «Новички»: «Ты наставник: Тимур А.»", await until(async () => /Ты наставник: Тимур А\./.test(await hubSub(i.page, "Новички")), 6000), await hubSub(i.page, "Новички"));
  const v = await open({ who: VERA, srv });
  await nav(v.page, "teamHub", 1800);
  ok("HUB: сотруднику (Вера) — «Новичков» нет", !(await hubItem(v.page, "Новички").count()));
  const [e1, e2] = noErr(k, a, m, i, v); ok("HUB: без ошибок", e1, e2);
  for (const x of [k, a, m, i, v]) await x.ctx.close();
});

await run("WEEK", async () => {
  const srv = srvOf();
  const k = await open({ who: KSENIA, srv });
  await toWeek(k.page);
  ok("WEEK: «Добро пожаловать, Ксения» и строка: заведение, официант, с нами 1 день", /Добро пожаловать, Ксения/.test(await txt(k.page.locator("[data-nb-hello]")))
    && /Два моря, Океан · официант · с нами 1 день/.test(await txt(k.page.locator("[data-nb-hello]"))), await txt(k.page.locator("[data-nb-hello]")));
  const first = await txt(k.page.locator('[data-nb-sec="first"]'));
  ok("WEEK: первая смена — завтра, «День 12:00–20:00», дата словами", (await k.page.locator(`[data-nb-first="${D(1)}"]`).count()) === 1 && /Завтра, День 12:00–20:00/.test(first)
    && first.includes(dayMon(D(1))), first);
  ok("WEEK: памятка — к 11:45 (за 15 минут), как найти, форма, кто встретит, ещё", /Приходи к 11:45/.test(first) && /Как найти: Служебный вход со двора/.test(first)
    && /Форма: Чёрный верх, тёмные брюки/.test(first) && /Тебя встретит менеджер смены/.test(first) && /Обед для команды в 15:30/.test(first), first);
  ok("WEEK: наставника пока нет — «назначит руководитель»", (await k.page.locator("[data-nb-nobuddy]").count()) === 1);
  const foc = await txt(k.page.locator('[data-nb-sec="focus"]'));
  const order = await k.page.evaluate(() => [...document.querySelectorAll("[data-nb-sec]")].map((e) => e.getAttribute("data-nb-sec")));
  ok("WEEK: план начинается с тем собеседования — «Конфликты…» (урок «Работа с жалобами»), «Честность и деньги»", order.indexOf("focus") >= 0 && order.indexOf("focus") < order.indexOf("d1")
    && /С собеседования/i.test(foc) && /дались труднее всего/.test(foc) && (await step(k.page, F1).count()) === 1 && /Работа с жалобами/.test(await txt(step(k.page, F1)))
    && (await step(k.page, F2).count()) === 1 && (await k.page.locator('[data-nb-open="s4"]').count()) === 1, order.join(",") + " · " + foc.slice(0, 200));
  ok("WEEK: «сделано 1 из 12»", /сделано 1 из 12/.test(await txt(k.page.locator('[data-nb-h="plan"]'))), await txt(k.page.locator('[data-nb-h="plan"]')));
  await shot(k.page, "week");
  await step(k.page, "d1a").click(); await sleep(900);
  ok("WEEK: свой шаг отмечен — на экране и на сервере («сделано 2 из 12»)", (await step(k.page, "d1a").getAttribute("data-nb-done")) === "1" && !!srv.S.nb["e-ksenia"].checked.d1a
    && /сделано 2 из 12/.test(await txt(k.page.locator('[data-nb-h="plan"]'))));
  await step(k.page, "d1a").click(); await sleep(900);
  ok("WEEK: второе нажатие — снят", (await step(k.page, "d1a").getAttribute("data-nb-done")) === "0" && !srv.S.nb["e-ksenia"].checked.d1a);
  const d2c = step(k.page, "d2c");
  await d2c.click(); await sleep(600);
  ok("WEEK: «5 столов под присмотром» подтверждает наставник — сам новичок не отмечает", (await d2c.getAttribute("role")) === null && (await d2c.getAttribute("data-nb-done")) === "0"
    && /Подтверждает наставник/.test(await txt(d2c)) && !srv.S.nb["e-ksenia"].checked.d2c);
  await k.page.locator('[data-nb-open="s4"]').click(); await sleep(1600);
  ok("WEEK: «Открыть» — урок «Работа с жалобами»", !(await k.page.locator("[data-newbie]").count()) && /Работа с жалобами/.test(await body(k.page)));
  const [e1, e2] = noErr(k); ok("WEEK: без ошибок", e1, e2);
  await k.ctx.close();
});

await run("AUTO", async () => {
  const srv = srvOf({ progress: { "e-ksenia": ["s4-1", "s4-2", "s4-p"] }, quizzes: { "e-ksenia": ["s4-q"] } });
  const k = await open({ who: KSENIA, srv });
  await toWeek(k.page);
  const got = await until(() => !!srv.S.nb["e-ksenia"].checked[F1], 6000);
  ok("AUTO: «Работа с жалобами» пройдена — тема отмечена сама, «Повторить», на сервере отметка", (await step(k.page, F1).getAttribute("data-nb-done")) === "1"
    && /Повторить/.test(await txt(k.page.locator('[data-nb-open="s4"]'))) && !!got && (lastCall(srv, "newbie_check") || { body: {} }).body.p_steps.includes(F1),
    JSON.stringify(srv.S.nb["e-ksenia"].checked));
  ok("AUTO: вторая тема не пройдена — не отмечена", (await step(k.page, F2).getAttribute("data-nb-done")) === "0");
  await k.ctx.close();
});

await run("TIMUR", async () => {
  const srv = srvOf();
  const t = await open({ who: TIMUR, srv });
  await toWeek(t.page);
  const b = await txt(t.page.locator('[data-nb-sec="buddy"]'));
  ok("TIMUR: наставник — Илья Белов, бармен", (await t.page.locator('[data-nb-buddy="e-ilya"]').count()) === 1 && /Илья Белов/.test(b) && /Бармен · покажет, где что/.test(b), b);
  ok("TIMUR: первая смена уже была — не наверху, а строкой «Первая смена была …»", !(await t.page.locator('[data-nb-sec="first"]').count()) && b.includes("Первая смена была " + dayMon(D(-5))), b);
  ok("TIMUR: «5 столов» подтверждено наставником", (await step(t.page, "d2c").getAttribute("data-nb-done")) === "1" && /Подтверждено: Илья Б\./.test(await txt(step(t.page, "d2c"))));
  ok("TIMUR: собеседования нет — тем с собеседования нет, «сделано 3 из 10»", !(await t.page.locator('[data-nb-sec="focus"]').count()) && /сделано 3 из 10/.test(await txt(t.page.locator('[data-nb-h="plan"]'))));
  await t.page.locator('[data-nb-sec="buddy"] [data-nb-dm="e-ilya"]').click();
  ok("TIMUR: «Написать» — личная переписка с Ильёй", await until(async () => /Илья/.test(await txt(t.page.locator(".ch-head .ch-title"))), 6000), await txt(t.page.locator(".ch-head")));
  const [e1, e2] = noErr(t); ok("TIMUR: без ошибок", e1, e2);
  await t.ctx.close();
});

await run("LEAD", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toList(m.page);
  const memo = await txt(m.page.locator("[data-nbl-memo]"));
  ok("LEAD: руководитель; памятка — за 15 минут, как найти, форма, кто встретит, ещё", (await m.page.locator('[data-newbies-lead="1"]').count()) === 1
    // v110 (Доп. 423): памятка — внизу и коротко: «Приходить за 15 минут до смены», остальное строкой
    && /Приходить за 15 минут до смены/.test(memo) && /Служебный вход со двора/.test(memo) && /Чёрный верх/.test(memo)
    && /встретит наставник или менеджер смены/.test(memo) && /Обед для команды/.test(memo), memo);
  const ids = await m.page.evaluate(() => [...document.querySelectorAll("[data-nbl-item]")].map((e) => e.getAttribute("data-nbl-item")));
  const ks = await txt(item(m.page, "e-ksenia")), tm = await txt(item(m.page, "e-timur"));
  ok("LEAD: двое, новые сверху: Ксения, Тимур", ids.join(",") === "e-ksenia,e-timur", ids.join(","));
  ok("LEAD: Ксения — первая смена завтра, наставник не назначен, собеседование с темами и баллами, 1 из 12",
    /Первая смена: завтра, 12:00/.test(ks) && /Наставник не назначен/.test(ks) && ks.includes("Собеседование " + dayMon(D(-6)) + ", слабые темы: конфликты и сложные ситуации 45 из 100 честность и деньги 62 из 100")   /* v110: темы плашками */ && /1 из 12/.test(ks), ks);
  ok("LEAD: Тимур — первая смена была, наставник Илья Б., собеседование не найдено, 3 из 10",
    tm.includes("Первая смена была " + dayMon(D(-5))) && /Наставник: Илья Б\./.test(tm) && /Собеседование не найдено/.test(tm) && /3 из 10/.test(tm), tm);
  await shot(m.page, "lead");
  await expand(m.page, "e-ksenia");
  await m.page.locator('[data-nbl-buddy="e-ksenia"]').click(); await sleep(700);
  const rows = await m.page.evaluate(() => [...document.querySelectorAll('[data-nb-sheet="buddy"] [data-nb-pick]')].map((e) => e.getAttribute("data-nb-pick") + "|" + e.innerText.replace(/\s+/g, " ")));
  ok("LEAD: выбор наставника — сначала официанты, у Ильи «ведёт: 1», новичков в списке нет", rows.length === 7 && rows.slice(0, 4).map((r) => r.split("|")[0]).join(",") === "e-anna,e-vera,e-darya,e-petr"
    && rows.some((r) => /^e-ilya\|.*ведёт: 1/.test(r)) && !rows.some((r) => /e-ksenia|e-timur/.test(r)), rows.join(" ; "));
  await shot(m.page, "lead-buddy");
  await pick(m.page, "e-anna");
  const n = srv.S.nb["e-ksenia"], hm = srv.S.msgs.find((x) => x.card && x.card.t === "hello" && x.card.emp === "e-ksenia");
  ok("LEAD: «Анна Смирнова» — наставник на сервере, команда увидела «Знакомьтесь»", n.buddy === "e-anna" && !!hm && hm.card.buddy && hm.card.buddy.id === "e-anna"
    && /Наставник назначен, команда увидела «Знакомьтесь»/.test(await txt(m.page.locator('[data-nbl-open="e-ksenia"] [data-nbl-note]'))), JSON.stringify({ b: n.buddy, hm: !!hm }));
  const ks2 = await txt(item(m.page, "e-ksenia"));
  ok("LEAD: в строке — «Наставник: Анна С.», «Представлена команде»", /Наставник: Анна С\./.test(ks2) && /Представлена команде/.test(ks2), ks2);
  await m.page.locator('[data-nbl-open="e-ksenia"] [data-nbl-chat]').click();
  ok("LEAD: «Открыть «Вся команда»» — чат, карточка «Знакомьтесь» Ксении", await until(async () => (await m.page.locator("[data-chat]").count()) > 0 && /Ксения Миронова/.test(await txt(card(m.page, "hello"))), 7000));
  const [e1, e2] = noErr(m); ok("LEAD: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("CONFIRM", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toList(m.page);
  await expand(m.page, "e-timur");
  const op = await txt(m.page.locator('[data-nbl-open="e-timur"]'));
  ok("CONFIRM: у Тимура «5 столов» подтвердил Илья, самостоятельной смены ещё нет", /5 столов под присмотром наставника Подтверждено: Илья Б\./.test(op) && /Первая самостоятельная смена Ещё не подтверждено/.test(op), op);
  await m.page.locator('[data-nbl-confirm="d3b"][data-nbl-emp="e-timur"]').click(); await sleep(1000);
  const n = srv.S.nb["e-timur"], sm = n.soloMsg && srv.S.msgs.find((x) => x.id === n.soloMsg);
  ok("CONFIRM: «Подтвердить» — самостоятельная смена на сервере и в строке", !!n.solo && n.soloBy === "u-maria" && /Самостоятельная смена: /.test(await txt(item(m.page, "e-timur"))), JSON.stringify({ solo: n.solo }));
  ok("CONFIRM: в «Вся команда» — карточка: Тимур, 5 дней с первой смены, наставник Илья", !!sm && sm.card.t === "solo" && sm.card.days === 5 && sm.card.buddy && sm.card.buddy.id === "e-ilya", JSON.stringify(sm && sm.card));
  await m.page.locator('[data-nbl-confirm="d3b"][data-nbl-emp="e-timur"]').click(); await sleep(1000);
  ok("CONFIRM: «Снять» — самостоятельной смены нет, карточка из чата ушла", !n.solo && !!sm && sm.del === true && !(await m.page.locator('[data-nbl-item="e-timur"] [data-nbl-solo]').count()));
  const [e1, e2] = noErr(m); ok("CONFIRM: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("MEMO", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toList(m.page);
  await m.page.locator("[data-nbl-memo-edit]").click(); await sleep(700);
  ok("MEMO: «Изменить» — лист «Памятка новичку»", (await m.page.locator('[data-nb-sheet="memo"] [role="dialog"][aria-label="Памятка новичку"]').count()) === 1);
  await m.page.locator('[data-nb-memo="addr"]').fill("Вход с улицы, дверь с вывеской");
  await m.page.locator('[data-nb-arrive="20"]').click();
  await m.page.locator('[data-nb-memo="meet"]').fill("Ольга, хостес");
  await shot(m.page, "memo");
  await m.page.locator("[data-nb-memo-save]").click(); await sleep(1000);
  const memo = await txt(m.page.locator("[data-nbl-memo]"));
  ok("MEMO: сохранено — на сервере и в карточке", srv.S.nbMemo.addr === "Вход с улицы, дверь с вывеской" && srv.S.nbMemo.arrive === 20 && srv.S.nbMemo.meet === "Ольга, хостес"
    && !(await m.page.locator("[data-nb-sheet]").count()) && /за 20 минут/.test(memo) && /Вход с улицы, дверь с вывеской/.test(memo) && /встретит наставник или Ольга, хостес/.test(memo), memo);
  const k = await open({ who: KSENIA, srv });
  await toWeek(k.page);
  const first = await txt(k.page.locator('[data-nb-sec="first"]'));
  ok("MEMO: новичок видит новое — к 11:40, вход с улицы, встретит Ольга", /Приходи к 11:40/.test(first) && /Как найти: Вход с улицы/.test(first) && /Тебя встретит: Ольга, хостес/.test(first), first);
  const [e1, e2] = noErr(m, k); ok("MEMO: без ошибок", e1, e2);
  await m.ctx.close(); await k.ctx.close();
});

await run("CAND", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toList(m.page);
  await expand(m.page, "e-ksenia");
  await m.page.locator('[data-nbl-cand="e-ksenia"]').click(); await sleep(700);
  const rows = await m.page.evaluate(() => [...document.querySelectorAll('[data-nb-sheet="cand"] [data-nb-pick]')].map((e) => e.getAttribute("data-nb-pick") + "|" + e.innerText.replace(/\s+/g, " ")));
  ok("CAND: «Берём» — Глеб и Ксения (сейчас), «Найти само», «Без собеседования»", rows.map((r) => r.split("|")[0]).join(",") === "502,501,0,-1" && /^501\|.*сейчас/.test(rows[1]) && /сервис и гость 33/.test(rows[0]), rows.join(" ; "));
  await pick(m.page, "-1");
  ok("CAND: «Без собеседования» — на сервере и в строке, 1 из 10", srv.S.nb["e-ksenia"].cand === -1 && /Без собеседования/.test(await txt(item(m.page, "e-ksenia"))) && /1 из 10/.test(await txt(item(m.page, "e-ksenia"))));
  const k = await open({ who: KSENIA, srv });
  await toWeek(k.page);
  ok("CAND: у новичка — без тем с собеседования, «сделано 1 из 10»", !(await k.page.locator('[data-nb-sec="focus"]').count()) && /сделано 1 из 10/.test(await txt(k.page.locator('[data-nb-h="plan"]'))));
  await m.page.locator('[data-nbl-cand="e-ksenia"]').click(); await sleep(700); await pick(m.page, "502");
  ok("CAND: другое собеседование — его темы", srv.S.nb["e-ksenia"].cand === 502 && /Собеседование .*: сервис и гость 33/.test(await txt(item(m.page, "e-ksenia"))), await txt(item(m.page, "e-ksenia")));
  await m.page.locator('[data-nbl-cand="e-ksenia"]').click(); await sleep(700); await pick(m.page, "0");
  ok("CAND: «Найти само» — снова собеседование Ксении", srv.S.nb["e-ksenia"].cand === null && /конфликты и сложные ситуации 45/.test(await txt(item(m.page, "e-ksenia"))));
  const [e1, e2] = noErr(m, k); ok("CAND: без ошибок", e1, e2);
  await m.ctx.close(); await k.ctx.close();
});

await run("ADD", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toList(m.page);
  await m.page.locator("[data-nbl-add]").click(); await sleep(700);
  const rows = await m.page.evaluate(() => [...document.querySelectorAll('[data-nb-sheet="add"] [data-nb-pick]')].map((e) => e.getAttribute("data-nb-pick")));
  ok("ADD: «Добавить новичка» — команда без новичков и без себя", rows.length === 6 && !rows.includes("u-maria") && !rows.includes("e-ksenia") && rows.includes("e-vera"), rows.join(","));
  await pick(m.page, "e-vera"); await sleep(600);
  ok("ADD: Вера в «Новичках» — с нами первый день", (await item(m.page, "e-vera").count()) === 1 && /с нами первый день/.test(await txt(item(m.page, "e-vera"))) && !!srv.S.nb["e-vera"]);
  const v = await open({ who: VERA, srv });
  await nav(v.page, "shift", 1400);
  await until(async () => (await hubItem(v.page, "Первая неделя").count()) > 0, 6000);
  ok("ADD: у Веры во вкладке «Смена» первым — «Первая неделя»", (await hubFirst(v.page)) === "Первая неделя");
  await expand(m.page, "e-vera");
  await m.page.locator('[data-nbl-off="e-vera"]').click(); await sleep(400);
  ok("ADD: «Убрать из новичков» — сначала «Убрать? Нажми ещё раз»", /Убрать\? Нажми ещё раз/.test(await txt(m.page.locator('[data-nbl-off="e-vera"]'))) && !srv.S.nb["e-vera"].off);
  await m.page.locator('[data-nbl-off="e-vera"]').click(); await sleep(900);
  ok("ADD: второе нажатие — убрана", srv.S.nb["e-vera"].off === true && !(await item(m.page, "e-vera").count()));
  const [e1, e2] = noErr(m, v); ok("ADD: без ошибок", e1, e2);
  await m.ctx.close(); await v.ctx.close();
});

await run("BUDDY", async () => {
  const nbs = NEWBIES(); nbs[0].buddy = "e-anna"; nbs[0].buddyBy = "u-maria";
  const srv = srvOf({ newbies: nbs });
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "teamHub", 1400);
  ok("BUDDY: у Анны во вкладке «Команда» — «Новички»: «Ты наставник: Ксения М.»", await until(async () => /Ты наставник: Ксения М\./.test(await hubSub(a.page, "Новички")), 6000), await hubSub(a.page, "Новички"));
  await toList(a.page);
  ok("BUDDY: «Ты наставник» — только своя Ксения, без памятки и строк руководителя", (await a.page.locator('[data-newbies-lead="0"]').count()) === 1 && /Ты наставник/.test(await txt(a.page.locator('[data-nb-h="list"]')))
    && (await a.page.locator("[data-nbl-item]").count()) === 1 && !(await a.page.locator("[data-nbl-memo]").count()) && !(await a.page.locator("[data-nbl-buddy-line], [data-nbl-cand-line], [data-nbl-add]").count()));
  await expand(a.page, "e-ksenia");
  const op = await txt(a.page.locator('[data-nbl-open="e-ksenia"]'));
  ok("BUDDY: «Встретить к 11:45, завтра», темы для занятий без баллов", /Встретить к 11:45, завтра/.test(op) && /Темы для занятий: конфликты и сложные ситуации, честность и деньги/.test(op) && !/ситуации 45|деньги 62/.test(op), op);
  await shot(a.page, "buddy");
  await a.page.locator('[data-nbl-confirm="d2c"][data-nbl-emp="e-ksenia"]').click(); await sleep(900);
  ok("BUDDY: Анна подтверждает «5 столов»", !!srv.S.nb["e-ksenia"].confirm.d2c && srv.S.nb["e-ksenia"].confirm.d2c.by === "e-anna" && /Подтверждено: Анна С\./.test(await txt(a.page.locator('[data-nbl-open="e-ksenia"]'))));
  const i = await open({ who: ILYA, srv });
  await toList(i.page);
  await expand(i.page, "e-timur");
  ok("BUDDY: у Ильи Тимур, первая смена уже была — «Встретить к» нет", !/Встретить к/.test(await txt(i.page.locator('[data-nbl-open="e-timur"]'))));
  await i.page.locator('[data-nbl-confirm="d3b"][data-nbl-emp="e-timur"]').click(); await sleep(1000);
  ok("BUDDY: Илья подтверждает самостоятельную смену — карточка в чате", !!srv.S.nb["e-timur"].solo && srv.S.nb["e-timur"].soloBy === "e-ilya" && srv.S.msgs.some((x) => x.card && x.card.t === "solo" && x.card.emp === "e-timur" && !x.del));
  await nav(i.page, "teamHub", 900); await toList(i.page);
  ok("BUDDY: «Ты вывел на самостоятельную смену»: Тимур А.", /Ты вывел на самостоятельную смену/.test(await txt(i.page.locator('[data-nb-h="led"]'))) && /Тимур А\., /.test(await txt(i.page.locator("[data-nbl-led]"))),
    await txt(i.page.locator("[data-nbl-led]")));
  await expand(i.page, "e-timur");
  await i.page.locator('[data-nbl-dm="e-timur"]').click();
  ok("BUDDY: «Написать: Тимур» — личная переписка", await until(async () => /Тимур/.test(await txt(i.page.locator(".ch-head .ch-title"))), 6000), await txt(i.page.locator(".ch-head")));
  const [e1, e2] = noErr(a, i); ok("BUDDY: без ошибок", e1, e2);
  await a.ctx.close(); await i.ctx.close();
});

await run("CHAT", async () => {
  const srv = srvOf({ hello: true });
  const v = await open({ who: VERA, srv });
  await v.page.locator("[data-chat-disc]").first().click(); await sleep(1300);
  ok("CHAT: в списке чатов — «Знакомьтесь: Ксения Миронова, официант»", /Знакомьтесь: Ксения Миронова, официант/.test(await txt(v.page.locator('[data-chat-item="team"]'))), await txt(v.page.locator('[data-chat-item="team"]')));
  await v.page.locator('[data-chat-item="team"]').first().click(); await sleep(1500);
  const c1 = await txt(card(v.page, "hello"));
  ok("CHAT: карточка «Знакомьтесь»: Ксения, официант, первая смена, «Пока никто не поздоровался», «Поздороваться»", /Знакомьтесь/i.test(c1) && /Ксения Миронова/.test(c1)
    && c1.includes("Официант · первая смена: " + dShort(D(1)) + ", 12:00") && /Пока никто не поздоровался/.test(c1) && (await card(v.page, "hello").locator("[data-chat-greet]").count()) === 1, c1);
  await shot(v.page, "chat-hello");
  await card(v.page, "hello").locator("[data-chat-greet]").click(); await sleep(900);
  const c2 = await txt(card(v.page, "hello"));
  ok("CHAT: «Поздороваться» — «Поздоровались: ты», кнопки больше нет, на сервере Вера", /Поздоровались: ты/.test(c2) && !(await card(v.page, "hello").locator("[data-chat-greet]").count())
    && (srv.msgOf(srv.hello.id).card.greet || []).some((g) => g.id === "e-vera"), c2);
  const k = await open({ who: KSENIA, srv });
  await toWeek(k.page);
  ok("CHAT: новичок в «Первой неделе» — «Тебя представили в «Вся команда»: поздоровались 1»", /Тебя представили в «Вся команда»: поздоровались 1/.test(await txt(k.page.locator("[data-nb-team]"))), await txt(k.page.locator("[data-nb-team]")));
  await k.page.locator("[data-nb-team] [data-nb-chat]").click();
  await until(async () => (await k.page.locator('[data-chat-card="hello"]').count()) > 0, 7000);
  const c3 = await txt(card(k.page, "hello"));
  ok("CHAT: «Открыть чат» — у новичка своя карточка: «С тобой поздоровались: Вера С.», без кнопки", /С тобой поздоровались: Вера С\./.test(c3) && !(await card(k.page, "hello").locator("[data-chat-greet]").count()), c3);
  srv.rpc("newbie_confirm", { p_token: "tok-e-ilya", p_emp: "e-timur", p_step: "d3b" });
  const p = await open({ who: PETR, srv });
  await openTeam(p.page);
  const s1 = await txt(card(p.page, "solo"));
  ok("CHAT: «Самостоятельная смена»: «Тимур вышел…», 5 дней с первой смены, наставник, «Поздравить»", /Тимур вышел на самостоятельную смену/.test(s1) && /Наставник Илья Б\. · 5 дней с первой смены/.test(s1)
    && (await card(p.page, "solo").locator("[data-chat-greet]").count()) === 1 && /Поздравить/.test(await txt(card(p.page, "solo").locator("[data-chat-greet]"))), s1);
  await shot(p.page, "chat-solo");
  await card(p.page, "solo").locator("[data-chat-greet]").click(); await sleep(900);
  ok("CHAT: «Поздравить» — «Поздравили: ты»", /Поздравили: ты/.test(await txt(card(p.page, "solo"))));
  const t = await open({ who: TIMUR, srv });
  await toWeek(t.page);
  ok("CHAT: у Тимура в «Первой неделе» — «Ты вышел на самостоятельную смену», подтвердил Илья", /Ты вышел на самостоятельную смену/.test(await txt(t.page.locator("[data-nb-solo]"))) && /подтвердил Илья Б\./.test(await txt(t.page.locator("[data-nb-solo]"))),
    await txt(t.page.locator("[data-nb-solo]")));
  await t.page.locator("[data-nb-solo] [data-nb-chat]").click();
  await until(async () => (await t.page.locator('[data-chat-card="solo"]').count()) > 0, 7000);
  ok("CHAT: у самого Тимура — «Ты вышел…», «Тебя поздравили: Пётр О.»", /Ты вышел на самостоятельную смену/.test(await txt(card(t.page, "solo"))) && /Тебя поздравили: Пётр О\./.test(await txt(card(t.page, "solo"))), await txt(card(t.page, "solo")));
  const [e1, e2] = noErr(v, k, p, t); ok("CHAT: без ошибок", e1, e2);
  for (const x of [v, k, p, t]) await x.ctx.close();
});

await run("PERSON", async () => {
  const srv = srvOf();
  const v = await open({ who: VERA, srv });
  await openTeam(v.page);
  await v.page.locator('[data-chat-who="e-ilya"]').last().click(); await sleep(1200);
  ok("PERSON: в карточке Ильи — «Наставник новичков · ведёт: Тимур А.»", /Наставник новичков · ведёт: Тимур А\./.test(await txt(v.page.locator("[data-chat-person-mentor]"))), await txt(v.page.locator("[data-chat-person]")));
  await shot(v.page, "person");
  const close = async () => { await v.page.locator("[data-chat-person] .ch-x").first().click({ timeout: 3000 }).catch(() => {}); await sleep(600); };
  await close();
  await v.page.locator('[data-chat-who="e-anna"]').last().click(); await sleep(1200);
  ok("PERSON: у Анны (никого не ведёт) отметки нет", (await v.page.locator("[data-chat-person='e-anna']").count()) === 1 && !(await v.page.locator("[data-chat-person-mentor]").count()));
  await close();
  srv.rpc("newbie_confirm", { p_token: "tok-e-ilya", p_emp: "e-timur", p_step: "d3b" });
  await v.page.locator('[data-chat-who="e-ilya"]').last().click(); await sleep(1200);
  ok("PERSON: после самостоятельной смены — «Наставник новичков · вышли на самостоятельную смену: Тимур А.»",
    /Наставник новичков · вышли на самостоятельную смену: Тимур А\./.test(await txt(v.page.locator("[data-chat-person-mentor]"))), await txt(v.page.locator("[data-chat-person]")));
  const [e1, e2] = noErr(v); ok("PERSON: без ошибок", e1, e2);
  await v.ctx.close();
});

await run("DEEP", async () => {
  const srv = srvOf();
  const k = await open({ who: KSENIA, srv, path: "/?go=newbie" });
  ok("DEEP: ?go=newbie (кнопка «Первая неделя» в памятке) — «Первая неделя»", !!(await until(() => k.page.locator('[data-newbie="ready"]').count(), 9000)));
  const i = await open({ who: ILYA, srv, path: "/?go=newbies" });
  ok("DEEP: ?go=newbies (кнопка «Новички» наставнику) — «Новички», свои", !!(await until(() => i.page.locator('[data-newbies="ready"][data-newbies-lead="0"]').count(), 9000)));
  const v = await open({ who: VERA, srv, path: "/?go=newbie" });
  await sleep(3500);
  ok("DEEP: не новичку ?go=newbie — прежний экран «Первая неделя»", !(await v.page.locator("[data-newbie]").count()) && /Первая неделя/.test(await body(v.page)), (await body(v.page)).slice(0, 160));
  const [e1, e2] = noErr(k, i, v); ok("DEEP: без ошибок", e1, e2);
  await k.ctx.close(); await i.ctx.close(); await v.ctx.close();
});

await run("MISSING", async () => {
  const srv = srvOf();
  const miss = (fn) => (/^newbie_/.test(fn) || fn === "chat_greet" || fn === "chat_newbie_mark" ? { code: "PGRST202", message: "no fn" } : undefined);
  const k = await open({ who: KSENIA, srv, rpcs: miss });
  await nav(k.page, "shift", 2000);
  ok("MISSING: новичку — прежний пункт «Первая неделя» («Твой план адаптации по дням»)", /Твой план адаптации по дням/.test(await hubSub(k.page, "Первая неделя")), await hubSub(k.page, "Первая неделя"));
  await hubItem(k.page, "Первая неделя").click(); await sleep(2200);
  ok("MISSING: открывается прежний экран (без этапа 41)", !(await k.page.locator("[data-newbie]").count()) && /Первая неделя/.test(await body(k.page)));
  const m = await open({ who: MARIA, srv, rpcs: miss, seedExtra: { ["sa_last_role_Мария_Ким"]: JSON.stringify("manager") } });
  await nav(m.page, "teamHub", 2000);
  ok("MISSING: руководителю — прежние «Новички» («План первой недели и прогресс новых сотрудников»)", /План первой недели и прогресс новых сотрудников/.test(await hubSub(m.page, "Новички")), await hubSub(m.page, "Новички"));
  await hubItem(m.page, "Новички").click(); await sleep(2200);
  ok("MISSING: открывается прежний экран «Новички на онбординге»", !(await m.page.locator("[data-newbies]").count()) && /Новички на онбординге/.test(await body(m.page)), (await body(m.page)).slice(0, 160));
  const [e1, e2] = noErr(k, m); ok("MISSING: без ошибок", e1, e2);
  await k.ctx.close(); await m.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const k = await open({ who: KSENIA, srv, light: true });
  await toWeek(k.page);
  const bg = await k.page.evaluate(() => getComputedStyle(document.querySelector('[data-nb-sec="first"]')).backgroundColor);
  const col = await k.page.evaluate(() => getComputedStyle(document.querySelector('[data-nb-hello] div')).color);
  ok("PAPER: «Для чтения» — светлые карточки, тёмный текст", luma(bg) > 0.8 && luma(col) < 0.35, bg + " · " + col);
  await shot(k.page, "paper-week");
  const m = await open({ who: MARIA, srv, light: true });
  await toList(m.page);
  await m.page.locator("[data-nbl-memo-edit]").click(); await sleep(700);
  const sh = await m.page.evaluate(() => getComputedStyle(document.querySelector("[data-nb-sheet] [role=dialog]")).backgroundColor);
  ok("PAPER: лист памятки — светлый", luma(sh) > 0.8, sh);
  await shot(m.page, "paper-memo");
  await k.ctx.close(); await m.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf({ hello: true });
  const k = await open({ who: KSENIA, srv, w: 320, h: 700 });
  await toWeek(k.page);
  const f1 = await fits(k.page);
  ok("NARROW: 320 px — «Первая неделя» без сдвига вбок", f1.sw <= f1.W && f1.n === 0, JSON.stringify(f1));
  await shot(k.page, "narrow-week");
  const m = await open({ who: MARIA, srv, w: 320, h: 700 });
  await toList(m.page);
  await expand(m.page, "e-ksenia");
  const f2 = await fits(m.page);
  ok("NARROW: 320 px — «Новички» с раскрытым новичком без сдвига вбок", f2.sw <= f2.W && f2.n === 0, JSON.stringify(f2));
  await shot(m.page, "narrow-list");
  await m.page.locator('[data-nbl-buddy="e-ksenia"]').click(); await sleep(700);
  const f3 = await sheetFits(m.page);
  ok("NARROW: лист выбора наставника — по ширине экрана", !f3.none && f3.over === 0 && f3.dw <= f3.W, JSON.stringify(f3));
  await shot(m.page, "narrow-pick");
  await k.ctx.close(); await m.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
