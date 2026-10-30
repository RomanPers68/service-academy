// e2e v108 (Доп. 421): тепло в команде. Владелец (29.10): «Вот эти» — «Спасибо коллеге» и дни рождения с годовщинами.
// Сервер — tools/claude/demo-app/fake-server.js (как у e2e-v107). Разделы:
//   TILE    — в «Вся команда» «+» → «Спасибо коллеге» во всю ширину, под «Опаздываю»;
//   SEND    — кому (поиск по имени), за что (подсказки по тому, кому спасибо), карточка в чате, на сервере; тому же второй
//             раз за день — «Сегодня ты уже благодарила этого коллегу: карточка выше»;
//   PLUS    — коллега: «Тоже спасибо» — раз; тот, кому спасибо, и автор кнопки не видят, видят, кто присоединился;
//   PERSON  — карточка коллеги: «Спасибо от коллег: N» и «Сказать спасибо» — лист сразу с ним (без «Другой»);
//   INTENT  — «Петя, спасибо, выручил на банкете» в строке ввода → «Спасибо карточкой» → лист с текстом; строка очищается;
//   CHEER   — «У Ильи сегодня день рождения» и «Вера год с нами» от «Академии» с «Поздравить» — раз; самому — «У тебя…»,
//             кто поздравил; бот написал Илье;
//   POKE    — расписания на сервере нет: приложение при открытии чата просит поставить праздники (cheer_poke);
//   ME      — «Я» → «Спасибо от коллег» рядом со «Спасибо от гостей»: неделя, месяц, всего, карточки, «Сказать спасибо
//             коллеге» — чат с листом, карточка — в чате;
//   STAR    — «Рейтинг» → «Сотрудник недели»: «спасибо» по 5 очков и строка «Спасибо от коллег: N»;
//   SCHED   — «График»: в «Сегодня» день рождения и годовщина; «Настройки» → «Сотрудники» → «В команде с»;
//   MISSING — этапа 42 нет: пункта «Спасибо от коллег» нет, лист говорит, что нужен этап 42;
//   PAPER   — «Для чтения»; NARROW — 320 px без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v108.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5299, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v108";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v108";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { dateWord } = await import(SRC + "/lib/team-warm.js");
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
const DM = TODAY.slice(8, 10) + "." + TODAY.slice(5, 7), Y = Number(TODAY.slice(0, 4));
const JOINED = TODAY.slice(5) === "02-29" ? null : DM + "." + (Y - 1);   // Вера — ровно год назад

const R0 = "Два моря, Океан";
const P = (id, name, surname, position) => ({ id, name, surname, restaurant: R0, position, is_admin: false });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter");
const PETR = P("e-petr", "Пётр", "Орлов", "waiter"), VERA = P("e-vera", "Вера", "Соколова", "waiter"), DARYA = P("e-darya", "Дарья", "Лебедева", "waiter"), ILYA = P("e-ilya", "Илья", "Белов", "bartender");
const PEOPLE = [MARIA, OLGA, ANNA, PETR, VERA, DARYA, ILYA];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160, bday: "14.02" }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 },
  { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160, bday: "21.11", joined: "02.06.2024" }, { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 },
  { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160, joined: JOINED }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160, bday: DM }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } }, split: {},
  rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: { waiter: { pattern: "even" } }, dayShift: "Д", staff: SSTAFF };
function planOf() {
  const out = {};
  for (let i = -31; i <= 45; i++) {
    const set = (sid, k) => { if (k && k !== "-") (out[sid] = out[sid] || {})[i] = k; };
    const c2 = ((i % 4) + 4) % 4;
    set(1, c2 < 2 ? "Д" : ""); set(2, c2 >= 2 ? "Д" : ""); set(7, c2 === 1 || c2 === 2 ? "В" : "");
    for (const sid of [3, 4, 5, 6]) set(sid, (i + sid) % 3 ? "Д" : "");
  }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0]));
// «спасибо» сегодня утром (до карточек праздников в 9:00): Мария — Анне (Пётр и Ольга присоединились), Ольга — Илье
const THX = [{ from: "u-maria", to: "e-anna", text: "выручила с банкетом на веранде", at: 0, time: "07:40", plus: ["e-petr", "e-olga"] },
  { from: "e-olga", to: "e-ilya", text: "помог с гостями у бара", at: 0, time: "08:10", plus: [] }];
function srvOf({ cheers = true, peer = THX } = {}) {
  const pings = [];
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU,
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"] }, tgLinked: ["u-maria", "e-anna", "e-ilya", "e-vera"], peerThanks: peer, cheers,
    ping: (to, text) => pings.push({ to, text }) });
  s.calls = []; s.pings = pings;
  s.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут.");
  s.bot.say("e-petr", "Возьму веранду сегодня.");
  for (const k of Object.keys(s.S.seen)) delete s.S.seen[k];   // это было раньше: сейчас их в чате нет (бот им пишет)
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
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !e.closest(".ch-veil") && !e.closest("[data-chat]"); }).map((e) => (typeof e.className === "string" && e.className ? e.className.slice(0, 40) : e.tagName)); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
const sheetFits = (page, sel) => page.evaluate((sel) => { const W = document.documentElement.clientWidth, d = document.querySelector(sel); if (!d) return { none: true }; const over = [...d.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; return { W, over, dw: Math.round(d.getBoundingClientRect().width) }; }, sel);
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const lastCall = (srv, fn) => [...srv.calls].reverse().find((c) => c.fn === fn) || null;
const card = (page, t) => page.locator(`[data-chat-card="${t}"]`).last();
const hubItem = (page, label) => page.locator(`.sa-card[aria-label="${label}"]`).first();
const openTeam = async (page) => {
  await page.locator("[data-chat-disc]").first().click(); await sleep(1300);
  await page.locator('[data-chat-item="team"]').first().click(); await sleep(1600);
};
const toast = (page) => txt(page.locator("[data-chat-toast]"));
const thxSheet = async (page) => { await page.locator("[data-chat-attach]").click(); await sleep(700); await page.locator('[data-chat-act="thx"]').click(); await sleep(1300); };
const thxCards = (srv) => srv.S.msgs.filter((m) => m.card && m.card.t === "thx" && !m.del);

// плитки «+»: где стоят, размеры, значок над подписью (владелец, 29.10: широкие кнопки внизу «выбиваются из общей эстетики»)
const tileGrid = (page) => page.evaluate(() => [...document.querySelectorAll("[data-chat-acts] [data-chat-act]")].map((e) => {
  const r = e.getBoundingClientRect(), i = e.querySelector(".ch-tile-i").getBoundingClientRect();
  return { id: e.getAttribute("data-chat-act"), x: Math.round(r.left), r: Math.round(r.right), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
    up: i.bottom < r.top + r.height * 0.7 && Math.abs((i.left + i.right) / 2 - (r.left + r.right) / 2) < 3 };
}));
// ряды полные: в каждом ряду плитки одной высоты, от левого края сетки до правого; ширины: треть или половина ряда
function rowsOk(g) {
  const L = Math.min(...g.map((t) => t.x)), R = Math.max(...g.map((t) => t.r)), rows = {};
  for (const t of g) (rows[t.y] = rows[t.y] || []).push(t);
  const rs = Object.values(rows);
  return g.every((t) => t.up && Math.abs(t.h - g[0].h) <= 1) && rs.every((row) => Math.abs(row[0].x - L) <= 1 && Math.abs(row[row.length - 1].r - R) <= 1
    && (row.length === 3 || row.length === 2) && row.every((t) => Math.abs(t.w - row[0].w) <= 1));
}
await run("TILE", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  await a.page.locator("[data-chat-attach]").click(); await sleep(800);
  const g = await tileGrid(a.page);
  const rowsA = [...new Set(g.map((t) => t.y))].map((y) => g.filter((t) => t.y === y).map((t) => t.id).join(" "));
  ok("TILE: у сотрудника в «Вся команда» «+» — ряды 3, 3, 2: последним рядом «Опаздываю» и «Спасибо коллеге», по половине", rowsA.join(" | ") === "photo give swap | share poll ai | late thx"
    && /Спасибо коллеге/.test(await txt(a.page.locator('[data-chat-act="thx"]'))), rowsA.join(" | "));
  ok("TILE: все плитки одного вида — значок над подписью, одной высоты; ряды без дыр, от края до края", rowsOk(g), JSON.stringify(g.map((t) => [t.id, t.x, t.y, t.w, t.h, t.up])));
  await shot(a.page, "tile");
  const m = await open({ who: MARIA, srv });
  await openTeam(m.page);
  await m.page.locator("[data-chat-attach]").click(); await sleep(800);
  const gm = await tileGrid(m.page);
  const rowsM = [...new Set(gm.map((t) => t.y))].map((y) => gm.filter((t) => t.y === y).map((t) => t.id).join(" "));
  ok("TILE: у руководителя — 3, 3, 3 и «Опаздываю» со «Спасибо коллеге» по половине; тот же вид", rowsM.join(" | ") === "photo give swap | task share poll | stop brief ai | late thx" && rowsOk(gm), rowsM.join(" | "));
  await shot(m.page, "tile-lead");
  const [e1, e2] = noErr(a, m); ok("TILE: без ошибок", e1, e2);
  await a.ctx.close(); await m.ctx.close();
});

await run("SEND", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  await thxSheet(a.page);
  const rows = await a.page.locator("[data-chat-thxsheet] [data-chat-person]").count();
  ok("SEND: «Спасибо коллеге» — кому: коллеги заведения без себя", (await a.page.locator('[data-chat-thxsheet="pick"]').count()) === 1 && rows === PEOPLE.length - 1
    && !(await a.page.locator('[data-chat-thxsheet] [data-chat-person="e-anna"]').count()), "rows=" + rows);
  await a.page.locator("[data-chat-thxsheet] [data-chat-search]").fill("пёт"); await sleep(400);
  ok("SEND: поиск по имени — один Пётр", (await a.page.locator("[data-chat-thxsheet] [data-chat-person]").count()) === 1);
  await shot(a.page, "send-pick");
  await a.page.locator('[data-chat-thxsheet] [data-chat-person="e-petr"]').click(); await sleep(600);
  const chips = await a.page.evaluate(() => [...document.querySelectorAll("[data-chat-thx-chip]")].map((e) => e.getAttribute("data-chat-thx-chip")));
  ok("SEND: кому — Пётр Орлов, официант; подсказки «за что» — для него", (await a.page.locator('[data-chat-thxsheet="write"] [data-chat-thx-who="e-petr"]').count()) === 1
    && chips.join(",") === "выручил на смене,подменил,помог с гостем,научил новому,поддержал" && (await a.page.locator("[data-chat-thx-other]").count()) === 1, chips.join(","));
  await a.page.locator('[data-chat-thx-chip="подменил"]').click(); await sleep(200);
  ok("SEND: подсказка — в поле «за что»", (await a.page.locator("[data-chat-thx-field]").inputValue()) === "подменил");
  await shot(a.page, "send-write");
  await a.page.locator("[data-chat-thx-go]").click(); await sleep(1300);
  const c1 = await txt(card(a.page, "thx"));
  const row = srv.S.thx.find((x) => x.from === "e-anna" && x.to === "e-petr");
  ok("SEND: карточка в чате — «Пётр Орлов», «Подменил»; на сервере — «спасибо» Анны Петру", /Пётр Орлов/.test(c1) && /Подменил/.test(c1) && /СПАСИБО · ты/i.test(c1) && !!row && row.text === "подменил", c1);
  ok("SEND: подсказка внизу — «Карточка в чате»", /Карточка в чате/.test(await toast(a.page)), await toast(a.page));
  await shot(a.page, "send-card");
  await thxSheet(a.page);
  await a.page.locator('[data-chat-thxsheet] [data-chat-person="e-petr"]').click(); await sleep(500);
  await a.page.locator("[data-chat-thx-go]").click(); await sleep(1300);
  ok("SEND: тому же второй раз за день — «Сегодня ты уже благодарила этого коллегу: карточка выше», второй карточки нет",
    /Сегодня ты уже благодарила этого коллегу: карточка выше/.test(await toast(a.page)) && thxCards(srv).filter((m) => m.emp === "e-anna").length === 1, await toast(a.page));
  const [e1, e2] = noErr(a); ok("SEND: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PLUS", async () => {
  const srv = srvOf();
  const m = srv.rpc("chat_thanks", { p_token: "tok-e-anna", p_to: "e-petr", p_text: "подменил в субботу" }).msg;
  const v = await open({ who: VERA, srv });
  await openTeam(v.page);
  const c1 = v.page.locator(`[data-chat-msg="${m.id}"]`);
  ok("PLUS: у Веры — «Тоже спасибо»", (await c1.locator("[data-chat-plus]").count()) === 1 && /Подменил в субботу/.test(await txt(c1)));
  await c1.locator("[data-chat-plus]").click(); await sleep(900);
  ok("PLUS: «Тоже спасибо» — «Ещё спасибо: ты», кнопки нет; на сервере Вера", /Ещё спасибо: ты/.test(await txt(c1)) && !(await c1.locator("[data-chat-plus]").count())
    && srv.S.thx.some((x) => x.msg === m.id && x.from === "e-vera" && !x.own), await txt(c1));
  await shot(v.page, "plus");
  const p = await open({ who: PETR, srv });
  await openTeam(p.page);
  const c2 = p.page.locator(`[data-chat-msg="${m.id}"]`);
  ok("PLUS: у Петра (это ему) — «Ещё спасибо тебе: Вера С.», без кнопки", /Ещё спасибо тебе: Вера С\./.test(await txt(c2)) && !(await c2.locator("[data-chat-plus]").count()), await txt(c2));
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  const c3 = a.page.locator(`[data-chat-msg="${m.id}"]`);
  ok("PLUS: у Анны (автор) — «Ещё спасибо: Вера С.», без кнопки", /Ещё спасибо: Вера С\./.test(await txt(c3)) && !(await c3.locator("[data-chat-plus]").count()), await txt(c3));
  const [e1, e2] = noErr(v, p, a); ok("PLUS: без ошибок", e1, e2);
  for (const x of [v, p, a]) await x.ctx.close();
});

await run("PERSON", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  await a.page.locator('[data-chat-who="e-ilya"]').last().click(); await sleep(1200);
  ok("PERSON: в карточке Ильи — «Спасибо от коллег: 1» и «Сказать спасибо»", /Спасибо от коллег: 1/.test(await txt(a.page.locator("[data-chat-person-thx]")))
    && (await a.page.locator('[data-chat-person-thanks="e-ilya"]').count()) === 1, await txt(a.page.locator("[data-chat-person]")));
  await shot(a.page, "person");
  await a.page.locator("[data-chat-person-thanks]").click(); await sleep(800);
  ok("PERSON: «Сказать спасибо» — лист сразу с Ильёй, без «Другой»", (await a.page.locator('[data-chat-thxsheet="write"] [data-chat-thx-who="e-ilya"]').count()) === 1
    && !(await a.page.locator("[data-chat-thx-other]").count()));
  await a.page.locator("[data-chat-thx-field]").fill("подменил на баре в субботу");
  await a.page.locator("[data-chat-thx-go]").click(); await sleep(1300);
  ok("PERSON: карточка Илье — «Подменил на баре в субботу»", thxCards(srv).some((x) => x.emp === "e-anna" && x.card.to.id === "e-ilya" && x.card.text === "подменил на баре в субботу")
    && /Илья Белов/.test(await txt(card(a.page, "thx"))));
  ok("PERSON: бот написал Илье: «Анна С. говорит тебе спасибо: «подменил на баре в субботу»»", srv.pings.some((x) => x.to === "e-ilya" && x.text === "Анна С. говорит тебе спасибо: «подменил на баре в субботу»"),
    JSON.stringify(srv.pings.slice(-3)));
  const [e1, e2] = noErr(a); ok("PERSON: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("INTENT", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  await a.page.locator("textarea.ch-input").fill("Петя, спасибо, выручил на банкете"); await sleep(500);
  ok("INTENT: «спасибо» в строке ввода — подсказка «Спасибо карточкой»", (await a.page.locator('[data-chat-sg="thx"]').count()) === 1 && /Спасибо карточкой/.test(await txt(a.page.locator('[data-chat-sg="thx"]'))));
  await a.page.locator('[data-chat-sg="thx"]').click(); await sleep(1200);
  await a.page.locator('[data-chat-thxsheet] [data-chat-person="e-petr"]').click(); await sleep(500);
  ok("INTENT: лист — кому выбрать, «за что» — из строки без «спасибо»", (await a.page.locator("[data-chat-thx-field]").inputValue()) === "Петя, выручил на банкете");
  await a.page.locator("[data-chat-thx-go]").click(); await sleep(1300);
  ok("INTENT: карточка ушла, строка ввода пустая", thxCards(srv).some((x) => x.emp === "e-anna" && x.card.text === "Петя, выручил на банкете") && (await a.page.locator("textarea.ch-input").inputValue()) === "");
  const [e1, e2] = noErr(a); ok("INTENT: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("CHEER", async () => {
  const srv = srvOf();
  const bd = srv.S.msgs.find((m) => m.card && m.card.t === "bday"), an = srv.S.msgs.find((m) => m.card && m.card.t === "anniv");
  ok("CHEER: на сервере — день рождения Ильи и годовщина Веры, от «Академии», бот написал Илье и Вере",
    !!bd && !!an && bd.name === "Академия" && bd.body === "День рождения: Илья Белов" && an.body === "Вера Соколова: год с нами"
    && srv.pings.some((x) => x.to === "e-ilya" && /^Илья, с днём рождения\nВ «Вся команда» тебя поздравляют\.$/.test(x.text)) && srv.pings.some((x) => x.to === "e-vera" && /^Вера, сегодня год, как ты с нами/.test(x.text)),
    JSON.stringify(srv.pings));
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  const c1 = a.page.locator(`[data-chat-msg="${bd.id}"]`), c2 = a.page.locator(`[data-chat-msg="${an.id}"]`);
  await c1.scrollIntoViewIfNeeded().catch(() => {});
  const t1 = await txt(c1), t2 = await txt(c2);
  ok("CHEER: «У Ильи сегодня день рождения», бармен, «Пока никто не поздравил», «Поздравить»", /День рождения · Академия · 09:00/i.test(t1) && /У Ильи сегодня день рождения/.test(t1)
    && /Бармен/.test(t1) && /Пока никто не поздравил/.test(t1) && (await c1.locator("[data-chat-cheer-go]").count()) === 1, t1);
  ok("CHEER: «Вера год с нами», «Официант · в команде с …», «Поздравить»", /Вера год с нами/.test(t2) && t2.includes("Официант · в команде с " + dateWord(TODAY.slice(5) === "02-29" ? "" : (Y - 1) + TODAY.slice(4)))
    && (await c2.locator("[data-chat-cheer-go]").count()) === 1, t2);
  await shot(a.page, "cheer");
  await c1.locator("[data-chat-cheer-go]").click(); await sleep(900);
  ok("CHEER: «Поздравить» — «Поздравили: ты», кнопки нет; на сервере Анна", /Поздравили: ты/.test(await txt(c1)) && !(await c1.locator("[data-chat-cheer-go]").count())
    && (srv.msgOf(bd.id).card.greet || []).some((g) => g.id === "e-anna"));
  const i = await open({ who: ILYA, srv });
  await openTeam(i.page);
  const c3 = i.page.locator(`[data-chat-msg="${bd.id}"]`);
  ok("CHEER: у самого Ильи — «У тебя сегодня день рождения», «Тебя поздравили: Анна С.», без кнопки", /У тебя сегодня день рождения/.test(await txt(c3)) && /Тебя поздравили: Анна С\./.test(await txt(c3))
    && !(await c3.locator("[data-chat-cheer-go]").count()), await txt(c3));
  await shot(i.page, "cheer-self");
  const [e1, e2] = noErr(a, i); ok("CHEER: без ошибок", e1, e2);
  await a.ctx.close(); await i.ctx.close();
});

await run("POKE", async () => {
  const srv = srvOf({ cheers: false });
  ok("POKE: расписания нет — карточек праздников пока нет", !srv.S.msgs.some((m) => m.card && (m.card.t === "bday" || m.card.t === "anniv")));
  const a = await open({ who: ANNA, srv });
  await a.page.locator("[data-chat-disc]").first().click(); await sleep(1500);
  ok("POKE: приложение открыло чат — cheer_poke, карточки поставлены", !!lastCall(srv, "cheer_poke") && srv.S.msgs.some((m) => m.card && m.card.t === "bday"));
  await a.page.locator('[data-chat-item="team"]').first().click(); await sleep(1600);
  ok("POKE: в «Вся команда» — день рождения Ильи", /У Ильи сегодня день рождения/.test(await txt(card(a.page, "bday"))));
  await a.ctx.close();
});

await run("ME", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "me", 1400);
  await until(async () => (await hubItem(a.page, "Спасибо от коллег").count()) > 0, 6000);
  const order = await a.page.evaluate(() => [...document.querySelectorAll(".sa-card[aria-label]")].map((e) => e.getAttribute("aria-label")));
  const gi = order.indexOf("Спасибо от гостей"), pi = order.indexOf("Спасибо от коллег");
  ok("ME: «Я» → «Спасибо от коллег» сразу за «Спасибо от гостей»: «3 раза за неделю коллеги сказали спасибо»", gi >= 0 && pi === gi + 1
    && /3 раза за неделю коллеги сказали спасибо/.test(await txt(hubItem(a.page, "Спасибо от коллег"))), order.join(",") + " · " + (await txt(hubItem(a.page, "Спасибо от коллег"))));
  await hubItem(a.page, "Спасибо от коллег").click();
  await until(() => a.page.locator('[data-peer="ok"]').count(), 9000); await sleep(400);
  const st = await txt(a.page.locator("[data-peer-stats]")), it = await txt(a.page.locator("[data-peer-item]"));
  ok("ME: за неделю 3 (+15 очков), за месяц 3, всего 3; карточка — сегодня, Мария К., за что, «Ещё спасибо: Пётр О., Ольга Л.»", /^3 спасибо за неделю \+15 очков в «Сотруднике недели» За месяц 3 · всего 3$/.test(st)   /* v110: крупно неделя и очки */
    && /сегодня · Мария К\./i.test(it) && /Выручила с банкетом на веранде/.test(it) && /Ещё спасибо: Пётр О\., Ольга Л\./.test(it), st + " · " + it);
  await shot(a.page, "me");
  await a.page.locator("[data-peer-item]").first().click();
  const thx = srv.S.thx.find((x) => x.to === "e-anna" && x.own);
  ok("ME: карточка — в чате, на этом сообщении", await until(async () => (await a.page.locator(`[data-chat] [data-chat-msg="${thx.msg}"]`).count()) > 0, 7000));
  for (let k = 0; k < 4 && (await a.page.locator("[data-chat]").count()); k++) { await a.page.evaluate(() => { const b = document.querySelector("[data-chat] [data-sa-back]"); if (b) b.click(); }); await sleep(500); }
  await a.page.locator("[data-peer-say]").click();
  ok("ME: «Сказать спасибо коллеге» — «Вся команда» с листом", await until(() => a.page.locator('[data-chat-thxsheet="pick"]').count(), 7000));
  const [e1, e2] = noErr(a); ok("ME: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("STAR", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "leaderboard", 2500);
  const st = await txt(a.page.locator("[data-week-thx]"));
  ok("STAR: «Сотрудник недели» — Анна: «Спасибо от коллег: 3», 15 очков", st === "Спасибо от коллег: 3" && /Анна Смирнова/.test(await body(a.page)) && /15 очков/.test(await body(a.page)), st);
  await shot(a.page, "star");
  await a.ctx.close();
});

await run("SCHED", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "schedule", 2600);
  await m.page.getByText(/^Сегодня · \d+/).first().click(); await sleep(800);
  const t = await body(m.page);
  ok("SCHED: в «Сегодня» — «День рождения: Белов Илья» и «Годовщина: Соколова Вера (год)»", /День рождения: Белов Илья/.test(t) && /Годовщина: Соколова Вера \(год\)/.test(t), t.slice(0, 300));
  await shot(m.page, "sched-today");
  await m.page.locator("[data-sched-tabs] button", { hasText: "Настройки" }).click(); await sleep(900);
  await m.page.getByText("Сотрудники", { exact: true }).first().click(); await sleep(700);
  await m.page.locator('.sa-schedemp[data-emp="5"] > div').first().click(); await sleep(700);
  const v = await m.page.locator('.sa-schedemp[data-emp="5"] [data-sched-dates] input').nth(1).inputValue().catch(() => "нет поля");
  ok("SCHED: «Настройки» → «Сотрудники» → Вера: «Д.р.» и «В команде с» — дата прихода", v === JOINED && (await m.page.locator('.sa-schedemp[data-emp="5"] [data-sched-dates]').innerText()).includes("В команде с"), v);
  await m.page.locator('.sa-schedemp[data-emp="5"] [data-sched-dates]').evaluate((e) => e.scrollIntoView({ block: "center" })).catch(() => {}); await sleep(400);
  await shot(m.page, "sched");
  const [e1, e2] = noErr(m); ok("SCHED: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("MISSING", async () => {
  const srv = srvOf();
  const miss = (fn) => (["chat_thanks", "chat_cheer", "thanks_peer", "thanks_week", "thanks_of", "cheer_poke"].includes(fn) ? { code: "PGRST202", message: "no fn" } : undefined);
  const a = await open({ who: ANNA, srv, rpcs: miss });
  await nav(a.page, "me", 2200);
  ok("MISSING: этапа 42 нет — в «Я» пункта «Спасибо от коллег» нет", !(await hubItem(a.page, "Спасибо от коллег").count()) && (await hubItem(a.page, "Спасибо от гостей").count()) === 1);
  await openTeam(a.page);
  await thxSheet(a.page);
  await a.page.locator('[data-chat-thxsheet] [data-chat-person="e-petr"]').click(); await sleep(500);
  await a.page.locator("[data-chat-thx-go]").click(); await sleep(900);
  ok("MISSING: лист — «На сервере ещё нет этапа 42. Руководителю: обновить сервер.»", /На сервере ещё нет этапа 42\. Руководителю: обновить сервер\./.test(await txt(a.page.locator("[data-chat-thx-err]"))));
  const [e1, e2] = noErr(a); ok("MISSING: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, light: true });
  await nav(a.page, "me", 1400);
  await until(async () => (await hubItem(a.page, "Спасибо от коллег").count()) > 0, 6000);
  await hubItem(a.page, "Спасибо от коллег").click();
  await until(() => a.page.locator('[data-peer="ok"]').count(), 9000); await sleep(300);
  const bg = await a.page.evaluate(() => getComputedStyle(document.querySelector("[data-peer-stats]")).backgroundColor);
  ok("PAPER: «Спасибо от коллег» в «Для чтения» — светлые карточки", /rgba\(250, 242, 222/.test(bg), bg);
  await shot(a.page, "paper");
  await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, w: 320, h: 700 });
  await nav(a.page, "me", 1400);
  await until(async () => (await hubItem(a.page, "Спасибо от коллег").count()) > 0, 6000);
  await hubItem(a.page, "Спасибо от коллег").click();
  await until(() => a.page.locator('[data-peer="ok"]').count(), 9000); await sleep(300);
  const f1 = await fits(a.page);
  ok("NARROW: 320 px — «Спасибо от коллег» без сдвига вбок", f1.sw <= f1.W && f1.n === 0, JSON.stringify(f1));
  await shot(a.page, "narrow-me");
  await a.page.locator("[data-peer-say]").click();
  await until(() => a.page.locator('[data-chat-thxsheet="pick"]').count(), 7000);
  await a.page.locator('[data-chat-thxsheet] [data-chat-person="e-petr"]').click(); await sleep(500);
  const f2 = await sheetFits(a.page, "[data-chat-thxsheet]");
  ok("NARROW: лист «Спасибо коллеге» — по ширине экрана, подсказки переносятся", !f2.none && f2.over === 0 && f2.dw <= f2.W, JSON.stringify(f2));
  await shot(a.page, "narrow-sheet");
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
