// e2e v106 (Доп. 419): «Утро руководителя». Владелец (29.10): «да, давай соберём» — сводка заведения руководителю каждое
// утро в Telegram и экраном в приложении. Сервер — tools/claude/demo-app/fake-server.js (как у e2e-v97). Разделы:
//   HUB     — у руководителя во вкладке «Смена» первым пункт «Утро руководителя», у официанта его нет;
//   SCREEN  — экран «Утро»: приветствие и дата, сегодня (смены, опоздание, брифинг не собран), неделя (нехватка, заявки),
//             стоп-лист, вчера («спасибо» гостей с цитатой, брифинг, занятия, чек-листы), давно не занимались, Telegram;
//   GO      — строки ведут: нехватка — в «График», заявка — в чат к карточке, «Собрать брифинг» — в брифинг;
//   NUDGE   — «Напомнить»: бот пишет сотруднику от руководителя, второй раз — «Уже сегодня»; без Telegram — подпись;
//   PREFS   — выключатель и час сохраняются на сервере; «Прислать сейчас» — бот пишет руководителю, повтор — «через минуту»;
//   LINK    — Telegram не подключён: «Подключить» открывает «Напоминания в Telegram»;
//   DEEP    — ссылки бота: ?go=morning — экран «Утро», ?go=briefing — брифинг; официанту ?go=morning — «только у руководителей»;
//   MISSING — этапа 40 нет на сервере: «Сводка появится, когда владелец обновит сервер»;
//   PAPER   — «Для чтения»; NARROW — 320 px без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v106.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5297, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v106";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v97";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
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

// ── дни: как в телефоне (Камчатка) ──
const TZ = "Asia/Kamchatka";
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const REAL = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
// v101: проверки смотрят на две недели вперёд в месяце графика. В конце месяца (29.10: «Дарья не сможет выйти» на +3 —
// уже ноябрь, а на экране октябрь) — сегодня на две недели раньше, день недели тот же; часы страницы и сервера — с тем
// же сдвигом (page.clock.install идёт своим ходом, таймеры работают).
const DIM = new Date(Date.UTC(+REAL.slice(0, 4), +REAL.slice(5, 7), 0)).getUTCDate();
const SHIFT_MS = (+REAL.slice(8, 10) + 13 > DIM ? -14 : 0) * 86400e3;
const TODAY = addD(REAL, SHIFT_MS / 86400e3);
const D = (n) => addD(TODAY, n);
const MK = TODAY.slice(0, 7);

const R0 = "Два моря, Океан";
const P = (id, name, surname, position) => ({ id, name, surname, restaurant: R0, position, is_admin: false });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter");
const PETR = P("e-petr", "Пётр", "Орлов", "waiter"), VERA = P("e-vera", "Вера", "Соколова", "waiter"), DARYA = P("e-darya", "Дарья", "Лебедева", "waiter"), ILYA = P("e-ilya", "Илья", "Белов", "bartender");
const PEOPLE = [MARIA, OLGA, ANNA, PETR, VERA, DARYA, ILYA];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 }, { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 },
  { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } }, split: {},
  rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: { waiter: { pattern: "even" } }, dayShift: "Д", staff: SSTAFF };
// две недели от сегодня по дням (индекс — смещение): Анне есть что забрать (Вера, +2), куда выйти (+6) и с кем поменяться (Пётр, +9)
const NEAR = { 3: "ДД-ВВ--ДД-ВВ--", 4: "В-ДД-ВВ-ДД-ВВ-", 5: "-ВВ-ДД-В-ДД-ВВ", 6: "Д--Д--Д-В--Д-Д" };
function planOf() {
  const out = {};
  for (let i = -31; i <= 45; i++) {
    const set = (sid, k) => { if (k && k !== "-") (out[sid] = out[sid] || {})[i] = k; };
    const c2 = ((i % 4) + 4) % 4;
    set(1, c2 < 2 ? "Д" : ""); set(2, c2 >= 2 ? "Д" : ""); set(7, c2 === 1 || c2 === 2 ? "В" : "");
    for (const sid of [3, 4, 5, 6]) { const row = NEAR[sid]; set(sid, i >= 0 && i < row.length ? row[i] : row[((i % row.length) + row.length) % row.length]); }
  }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0]));
function newServer({ seed = true } = {}) {
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU, wishes: [{ sid: 6, at: 3, kind: "hard" }],
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"] } });
  s.calls = [];
  if (seed) {
    s.bot.say("u-maria", "Доброе утро! Сегодня банкет на 12 человек в 19:00.");
    s.give = s.bot.offer("e-vera", D(2), "give", "Нужно к врачу").msg;
    s.need = s.bot.need("u-maria", D(6), "waiter", "В", 1).msg;
    s.swap = s.bot.offer("e-petr", D(9), "swap", "").msg;
    s.ilya = s.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут.");
  }
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
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && !e.closest(".sa-schedgrid") && !e.closest("[data-week-strip]") && getComputedStyle(e).position !== "fixed"; }).map((e) => (typeof e.className === "string" && e.className ? e.className.slice(0, 40) : e.tagName)); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const lastCall = (srv, fn) => [...srv.calls].reverse().find((c) => c.fn === fn) || null;
const card = (page, t) => page.locator(`[data-chat-card="${t}"]`).last();
const chatBack = async (page) => {
  if (await page.locator("[data-chat-shareto]").count()) { await page.locator("[data-chat-shareto] [data-sa-back]").first().click({ timeout: 3000 }).catch(() => {}); await sleep(500); }
  for (let i = 0; i < 3 && (await page.locator("[data-chat]").count()); i++) { await page.locator("[data-chat] .ch-back").first().click({ timeout: 3000 }).catch(() => {}); await sleep(700); }
};
const dayN = (iso) => Number(iso.slice(8));
const inMonth = (iso) => iso.slice(0, 7) === MK;

const lensOf = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((el) => {
  const r = el.getBoundingClientRect(), s = getComputedStyle(el), a = getComputedStyle(el, "::after");
  return { w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, img: s.backgroundImage.slice(0, 40), color: s.color, shadow: s.boxShadow.slice(0, 60), after: a.content, inset: a.top, ring: a.borderTopColor };
}), sel);
const isLens = (x, glass = "rgba(200, 169, 110, 0.12)") => x && x.bg === glass && x.img === "none" && x.after === '""' && x.inset === "-3.5px" && /inset/.test(x.shadow);
const openChat = async (page) => {
  await page.locator("[data-chat-disc]").first().click(); await sleep(1300);
  return page.locator("[data-chat-list] [data-chat-row], .ch-row").count();
};

const st = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((el) => {
  const r = el.getBoundingClientRect(), s = getComputedStyle(el), a = getComputedStyle(el, "::after");
  return { w: Math.round(r.width), h: Math.round(r.height), br: s.borderTopLeftRadius, bg: s.backgroundColor, img: s.backgroundImage.slice(0, 30), color: s.color, op: s.opacity,
    shadow: s.boxShadow.slice(0, 60), after: a.content, inset: a.top, abr: a.borderTopLeftRadius, dis: !!el.disabled };
}), sel);
const openTeam = async (page) => {
  await page.locator("[data-chat-disc]").first().click(); await sleep(1300);
  await page.getByText("Вся команда").first().click(); await sleep(1300);
};
const sheet = async (page, act) => {
  await page.locator("[data-chat-attach]").first().click(); await sleep(700);
  await page.locator(`[data-chat-act="${act}"]`).first().click(); await sleep(1300);
};
const closeSheet = async (page) => { await page.locator(".ch-sheet .ch-x").first().click().catch(() => {}); await sleep(700); };
const lensDisc = (x, glass) => x && x.br === "50%" && x.bg === glass && x.after === '""' && x.inset === "-3.5px" && /inset/.test(x.shadow);
const glassMain = (x, gold) => x && /radial-gradient/.test(x.img) && x.after === '""' && x.inset === "-3.5px" && x.abr === "999px" && x.color === gold;

// ── заведение утром: вчерашние «спасибо», занятия, брифинг и чек-листы; Telegram у Марии, Петра и Веры ──
function srvOf({ linked = ["u-maria", "e-petr", "e-vera"], late = true } = {}) {
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU.map((d, i) => (i === 2 || i === 3 ? { ...d, stop: { since: 1, by: "Мария Ким" } } : d)),
    wishes: [{ sid: 6, at: 3, kind: "hard" }], progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"] },
    thanks: [{ emp: "e-anna", at: -1, text: "Анна подсказала с вином, всё было идеально" }, { emp: "e-anna", at: -1, text: "Спасибо за внимательность" }, { emp: "e-petr", at: -1, text: "" }],
    learn: { "e-anna": [-1, -2], "e-vera": [-1], "e-olga": [-1], "e-ilya": [-1], "e-petr": [-9] },
    briefDays: { "-1": ["e-anna", "e-olga", "e-vera"] }, tgLinked: linked,
    checklists: { "-1": { open: { checked: ["o1", "o2", "o3", "o4", "o5", "o6"], done_at: D(-1) + "T09:52:00", by_name: "Ольга Л." }, close: { checked: ["c1", "c2"], done_at: null } } } });
  s.calls = [];
  s.give = s.bot.offer("e-vera", D(2), "give", "Нужно к врачу").msg;
  s.need = s.bot.need("u-maria", D(6), "waiter", "В", 1).msg;
  if (late) s.S.late["e-darya|" + TODAY] = { emp: "e-darya", name: "Дарья Лебедева", rest: R0, day: TODAY, min: 20, eta: "12:20", note: null, msg: null, ok: null, at: new Date().toISOString() };
  return s;
}
const toMorning = async (page) => { await nav(page, "shift", 1400); await page.getByText("Утро руководителя").first().click(); await until(() => page.locator('[data-morning="ready"]').count(), 9000); await sleep(500); };
const rowsOf = (page) => page.evaluate(() => [...document.querySelectorAll("[data-mo-row]")].map((r) => r.getAttribute("data-mo-row")));
const textOf = (page, key) => txt(page.locator(`[data-mo-row="${key}"]`));

await run("HUB", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "shift", 1400);
  const first = await a.page.evaluate(() => { const all = [...document.querySelectorAll("button, [role=button], div")].filter((e) => /^Утро руководителя/.test((e.innerText || "").trim()) && e.getClientRects().length); return all.length; });
  ok("HUB: руководителю во вкладке «Смена» — «Утро руководителя»", first > 0 && /Утро руководителя/.test(await body(a.page)) && /каждое утро в Telegram/.test(await body(a.page)));
  const order = await a.page.evaluate(() => { const t = document.body.innerText; return [t.indexOf("Утро руководителя"), t.indexOf("Брифинг смены"), t.indexOf("Чек-листы")]; });
  ok("HUB: первым в «На смене», до брифинга и чек-листов", order[0] >= 0 && order[0] < order[1] && order[0] < order[2], JSON.stringify(order));
  await shot(a.page, "hub");
  const b = await open({ who: ANNA, srv });
  await nav(b.page, "shift", 1400);
  ok("HUB: у официанта пункта нет", !/Утро руководителя/.test(await body(b.page)));
  const [e1, e2] = noErr(a, b); ok("HUB: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("SCREEN", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  const t = await body(a.page);
  ok("SCREEN: «Доброе утро, Мария» и дата с заведением", /Доброе утро, Мария/.test(t) && t.includes(R0), t.slice(0, 160));
  const rows = await rowsOf(a.page);
  ok("SCREEN: сегодня — смены по графику, опоздание Дарьи, брифинг не собран", rows.some((r) => /^sh-/.test(r)) && rows.includes("late-e-darya") && rows.includes("brief")
    && /Дарья Л\. опаздывает на 20 минут/.test(await textOf(a.page, "late-e-darya")) && /ещё не собран/.test(await textOf(a.page, "brief")), rows.join(","));
  ok("SCREEN: неделя — заявки Веры и «Ищем в смену»", rows.includes("open-" + srv.give.id) && rows.includes("open-" + srv.need.id) && /Вера С\. отдаёт смену/.test(await textOf(a.page, "open-" + srv.give.id)), rows.join(","));
  ok("SCREEN: стоп-лист — два блюда", (await a.page.locator('[data-mo-h="stop"]').innerText()).includes("2") && /,/.test(await textOf(a.page, "stop")));
  ok("SCREEN: вчера — «спасибо» с цитатой, брифинг, занятия, чек-листы (открытие 09:52, закрытие 2 из 6)",
    /Гости сказали спасибо 3 раза: Анна С\. \(2\), Пётр О\./.test(await textOf(a.page, "thanks")) && /«Анна подсказала с вином, всё было идеально»/.test(await textOf(a.page, "thanks"))
    && rows.includes("yreads") && rows.includes("learn") && /Открытие: 09:52 · Ольга Л\./.test(await textOf(a.page, "cl-open")) && /Закрытие: отмечено 2 из 6/.test(await textOf(a.page, "cl-close"))
    && /Предсменка: не отмечено/.test(await textOf(a.page, "cl-preshift")), rows.join(","));
  ok("SCREEN: давно не занимались — Пётр (9 дней) с «Напомнить», Дарья (ни разу) без Telegram", /9 дней без занятий/.test(await textOf(a.page, "idle-e-petr"))
    && (await a.page.locator('[data-mo-nudge="e-petr"]').count()) === 1 && /нет Telegram/.test(await textOf(a.page, "idle-e-darya")), rows.join(","));
  ok("SCREEN: Telegram — выключатель включён, 9:00, «Прислать сейчас»", (await a.page.locator('[data-mo-on="1"]').count()) === 1
    && (await a.page.locator('[data-mo-hour="9"][aria-pressed="true"]').count()) === 1 && (await a.page.locator("[data-mo-send]").count()) === 1);
  await shot(a.page, "screen");
  const f = await fits(a.page);
  ok("SCREEN: без сдвига вбок", f.sw <= f.W, JSON.stringify(f));
  const [e1, e2] = noErr(a); ok("SCREEN: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("GO", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  const hole = (await rowsOf(a.page)).find((r) => /^hole-\d/.test(r));
  if (hole) { await a.page.locator(`[data-mo-row="${hole}"]`).click(); await sleep(800); }
  const inSched = await until(async () => !(await a.page.locator("[data-morning]").count())
    && (await a.page.locator("[data-sched-month], [data-sched-tabs], [data-sched-gridcard], [data-sched-strip], [data-today-lates]").count()) > 0, 9000);
  ok("GO: «не хватает» — в «График»", !!hole && !!inSched, (hole || "нет строки") + " · " + (await body(a.page)).slice(0, 120));
  await toMorning(a.page);
  await a.page.locator(`[data-mo-row="open-${srv.give.id}"]`).click(); await sleep(2000);
  ok("GO: заявка Веры — чат открыт", (await a.page.locator("[data-chat]").count()) > 0);
  await chatBack(a.page);
  await toMorning(a.page);
  await a.page.locator("[data-mo-brief]").click(); await sleep(1500);
  ok("GO: «Собрать брифинг» — экран брифинга", /Брифинг смены/.test(await body(a.page)) && !(await a.page.locator('[data-morning]').count()));
  const [e1, e2] = noErr(a); ok("GO: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NUDGE", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  await a.page.locator('[data-mo-nudge="e-petr"]').click(); await sleep(900);
  ok("NUDGE: «Напомнить» Петру — «Напомнили», на сервере отметка", /Напомнили/.test(await txt(a.page.locator('[data-mo-nudge="e-petr"]'))) && !!srv.S.nudged["e-petr|" + TODAY]
    && !!lastCall(srv, "morning_nudge"), JSON.stringify(srv.S.nudged));
  // экран открыли заново (другой руководитель или позже) — сервер помнит: второй раз за день — «Уже сегодня»
  await nav(a.page, "roleSelect", 900); await toMorning(a.page);
  await a.page.locator('[data-mo-nudge="e-petr"]').click(); await sleep(900);
  ok("NUDGE: второй раз за день — «Уже сегодня»", /Уже сегодня/.test(await txt(a.page.locator('[data-mo-nudge="e-petr"]'))));
  await a.ctx.close();
});

await run("PREFS", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  await a.page.locator('[data-mo-hour="10"]').click(); await sleep(900);
  ok("PREFS: час 10:00 — на сервере и в подписи", (srv.S.morning["u-maria"] || {}).hour === 10 && /Каждое утро в 10:00/.test(await txt(a.page.locator('[data-mo-sec="tg"]'))), JSON.stringify(srv.S.morning));
  await a.page.locator("[data-mo-on]").click(); await sleep(900);
  ok("PREFS: выключила — на сервере выключено, часы спрятаны", (srv.S.morning["u-maria"] || {}).on === false && (await a.page.locator("[data-mo-hour]").count()) === 0
    && /Выключено/.test(await txt(a.page.locator('[data-mo-sec="tg"]'))));
  await a.page.locator("[data-mo-on]").click(); await sleep(900);
  ok("PREFS: включила снова — час прежний (10:00)", (srv.S.morning["u-maria"] || {}).on === true && (await a.page.locator('[data-mo-hour="10"][aria-pressed="true"]').count()) === 1);
  await a.page.locator("[data-mo-send]").click(); await sleep(1000);
  const n1 = await txt(a.page.locator("[data-mo-note]"));
  await a.page.locator("[data-mo-send]").click(); await sleep(1000);
  const n2 = await txt(a.page.locator("[data-mo-note]"));
  ok("PREFS: «Прислать сейчас» — отправлено; повтор в ту же минуту — подождать", /Отправил в Telegram/.test(n1) && /Через минуту можно ещё раз/.test(n2), n1 + " | " + n2);
  const [e1, e2] = noErr(a); ok("PREFS: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("LINK", async () => {
  const srv = srvOf({ linked: ["e-petr"] });
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  ok("LINK: Telegram не подключён — подсказка и «Подключить», «Прислать сейчас» нет", (await a.page.locator('[data-mo-row="nolink"]').count()) === 1 && (await a.page.locator("[data-mo-send]").count()) === 0);
  await a.page.locator("[data-mo-link]").click(); await sleep(1000);
  ok("LINK: «Подключить» — «Напоминания в Telegram»", (await a.page.locator('[role="dialog"][aria-label="Напоминания в Telegram"]').count()) === 1);
  await shot(a.page, "link");
  await a.ctx.close();
});

await run("DEEP", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, path: "/?go=morning" });
  const okA = await until(() => a.page.locator('[data-morning="ready"]').count(), 9000);
  ok("DEEP: ?go=morning — экран «Утро»", !!okA);
  const b = await open({ who: MARIA, srv, path: "/?go=briefing" });
  await sleep(2500);
  ok("DEEP: ?go=briefing — брифинг смены", /Брифинг смены/.test(await body(b.page)));
  const c = await open({ who: ANNA, srv, path: "/?go=morning" });
  await until(() => c.page.locator('[data-morning="error"]').count(), 9000);
  ok("DEEP: официанту ?go=morning — «только у руководителей»", /Этот экран только у руководителей/.test(await body(c.page)));
  const [e1, e2] = noErr(a, b, c); ok("DEEP: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close(); await c.ctx.close();
});

await run("MISSING", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, rpcs: (fn) => (fn === "morning_brief" ? { code: "PGRST202", message: "no fn" } : undefined) });
  await nav(a.page, "shift", 1400); await a.page.getByText("Утро руководителя").first().click();
  await until(() => a.page.locator('[data-morning="missing"]').count(), 9000);
  ok("MISSING: этапа 40 нет — «Сводка появится, когда владелец обновит сервер»", /Сводка появится, когда владелец обновит сервер \(этап 40\)/.test(await body(a.page)));
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, light: true });
  await toMorning(a.page);
  const bg = await a.page.evaluate(() => getComputedStyle(document.querySelector('[data-mo-sec="today"]')).backgroundColor);
  ok("PAPER: «Для чтения» — светлые карточки", /rgba\(250, 242, 222/.test(bg), bg);
  await shot(a.page, "paper");
  await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, w: 320, h: 700 });
  await toMorning(a.page);
  const f = await fits(a.page);
  ok("NARROW: 320 px — без сдвига вбок", f.sw <= f.W && f.n === 0, JSON.stringify(f));
  await shot(a.page, "narrow");
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
