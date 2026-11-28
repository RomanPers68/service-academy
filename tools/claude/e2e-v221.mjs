// e2e v221 (Доп. 547): «Утро руководителя» менеджеру только в дни его смен (этап 75). Владелец (28.11): «Нужно что бы
// оповещение приходило, кто сегодня на смене, только руководителю и владельцу. А вот менеджеру только когда у него
// рабочая смена». Сервер — tools/claude/demo-app/fake-server.js. Голова — из e2e-v106.mjs. Разделы:
//   DAYS    — у менеджера «Только в мои смены» по умолчанию, подпись «В дни твоих смен по графику»; «Каждый день»
//             сохраняется на сервере и остаётся после перезахода; обратно — снова только в смены;
//   OFF     — сегодня по графику выходной: «в Telegram сводка не придёт»; с «Каждый день» пояснения нет;
//   VAC     — отпуск; NONE — в графике нет: «пока сводка приходит каждый день»;
//   OWNER   — у владельца по умолчанию «Каждый день»; «Только в мои смены», а в графике его нет — пояснение;
//   HOUR    — час меняется, выбор дней остаётся; OFFSW — выключил «Присылать»: выбора дней нет;
//   MISSING — этапа 75 нет: выбора дней нет, подпись прежняя; FAIL — не сохранилось: выбор вернулся, «Не сохранилось»;
//   PAPER   — «Для чтения»; NARROW — 320 px без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v221.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5321, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v221";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v97";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
// сервер демо тянет lib/*.js с импортами без расширения (как у Vite), node их сам не найдёт: собираем esbuild, как run-tests
const G = "/home/claude/.npm-global/lib/node_modules";
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) {} } throw new Error("esbuild не найден"); })();
const BUNDLE = "/tmp/e2e-v221-demo-" + process.pid + ".mjs";
await esbuild.build({ stdin: { contents: 'export * from "./tools/claude/demo-app/fake-server.js"; export { DEMO_MENUS } from "./tools/claude/demo-app/menu-seed.js";', resolveDir: SRC, loader: "js" },
  bundle: true, format: "esm", platform: "node", target: "node20", outfile: BUNDLE, logLevel: "silent", nodePaths: [G],
  define: { "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: false }) }, loader: { ".woff": "dataurl", ".woff2": "dataurl", ".webp": "dataurl", ".png": "dataurl", ".jpg": "dataurl" },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
const { makeServer, SHIFTS, DEMO_MENUS: RESTAURANT_MENUS } = await import(BUNDLE);
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
const ROMAN = { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true };
PEOPLE.push(ROMAN); TOK[tok(ROMAN)] = ROMAN.id;
// план: у Марии (строка 1) смена сегодня — как в e2e-v106; off — сегодня выходной, завтра смена
function planFor({ mariaOff = false } = {}) {
  const pl = planOf();
  if (mariaOff) { pl[1] = { ...(pl[1] || {}) }; delete pl[1][0]; pl[1][1] = "Д"; pl[1][2] = "Д"; }
  return pl;
}
function srvOf({ off = false, vac = false, noMaria = false, no75 = false } = {}) {
  const dn = Number(TODAY.slice(8));
  const staff = SSTAFF.filter((s) => !(noMaria && s.id === 1)).map((s) => (vac && s.id === 1 ? { ...s, vacs: { [MK]: [[dn, dn]] } } : { ...s }));
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: staff, cfg: { ...CFG, staff }, plan: planFor({ mariaOff: off || vac }), menu: MENU,
    tgLinked: ["u-maria", "u-roman"], noStage75: no75 });
  s.calls = [];
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
const toMorning = async (page) => { await nav(page, "shift", 1400); await page.getByText("Утро руководителя").first().click(); await until(() => page.locator('[data-morning="ready"]').count(), 9000); await sleep(500); };
const tgText = (page) => txt(page.locator('[data-mo-sec="tg"]'));
const pressed = (page) => page.evaluate(() => [...document.querySelectorAll("[data-mo-day]")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-mo-day")).join(","));
const note = (page) => txt(page.locator("[data-mo-today]"));

await run("DAYS", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  const t1 = await tgText(a.page);
  ok("DAYS: у менеджера выбор дней, «Только в мои смены» по умолчанию", (await a.page.locator("[data-mo-day]").count()) === 2 && (await pressed(a.page)) === "shift"
    && /Каждый день/.test(t1) && /Только в мои смены/.test(t1), t1);
  ok("DAYS: подпись «В дни твоих смен по графику, в 9:00»; сегодня смена — пояснения нет",
    /В дни твоих смен по графику, в 9:00 по часам заведения/.test(t1) && (await a.page.locator("[data-mo-today]").count()) === 0, t1);
  await shot(a.page, "days");
  await a.page.locator('[data-mo-day="all"]').click(); await sleep(900);
  const c = lastCall(srv, "morning_shift_set");
  ok("DAYS: «Каждый день» — на сервере и в подписи", !!c && c.body.p_shift === false && (srv.S.morning["u-maria"] || {}).shift === false
    && (await pressed(a.page)) === "all" && /Каждое утро в 9:00 по часам заведения/.test(await tgText(a.page)), JSON.stringify(c && c.body));
  const b = await open({ who: MARIA, srv });
  await toMorning(b.page);
  ok("DAYS: перезашла — «Каждый день» на месте", (await pressed(b.page)) === "all");
  await b.page.locator('[data-mo-day="shift"]').click(); await sleep(900);
  ok("DAYS: обратно «Только в мои смены» — на сервере shift", (srv.S.morning["u-maria"] || {}).shift === true && (await pressed(b.page)) === "shift");
  const [e1, e2] = noErr(a, b); ok("DAYS: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("OFF", async () => {
  const srv = srvOf({ off: true });
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  const n = await note(a.page);
  ok("OFF: сегодня по графику выходной — «в Telegram сводка не придёт»", (await a.page.locator('[data-mo-today="off"]').count()) === 1
    && n === "Сегодня по графику выходной: в Telegram сводка не придёт.", n);
  await shot(a.page, "off");
  await a.page.locator('[data-mo-day="all"]').click(); await sleep(900);
  ok("OFF: «Каждый день» — пояснения нет", (await a.page.locator("[data-mo-today]").count()) === 0 && (await pressed(a.page)) === "all");
  await a.ctx.close();
});

await run("VAC", async () => {
  const srv = srvOf({ vac: true });
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  const n = await note(a.page);
  ok("VAC: сегодня отпуск — «в Telegram сводка не придёт»", n === "Сегодня по графику отпуск: в Telegram сводка не придёт.", n);
  await a.ctx.close();
});

await run("NONE", async () => {
  const srv = srvOf({ noMaria: true });
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  const n = await note(a.page);
  ok("NONE: в графике нет — «пока сводка приходит каждый день»", (await a.page.locator('[data-mo-today="none"]').count()) === 1
    && n === "Тебя нет в графике этого месяца, поэтому пока сводка приходит каждый день.", n);
  await a.ctx.close();
});

await run("OWNER", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv });
  await toMorning(a.page);
  ok("OWNER: у владельца по умолчанию «Каждый день»", (await pressed(a.page)) === "all" && /Каждое утро в 9:00/.test(await tgText(a.page)));
  await a.page.locator('[data-mo-day="shift"]').click(); await sleep(900);
  ok("OWNER: «Только в мои смены», а в графике его нет — пояснение", (srv.S.morning["u-roman"] || {}).shift === true && /Тебя нет в графике этого месяца/.test(await note(a.page)));
  await a.ctx.close();
});

await run("HOUR", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  await a.page.locator('[data-mo-hour="10"]').click(); await sleep(900);
  ok("HOUR: 10:00 — «В дни твоих смен по графику, в 10:00»", (srv.S.morning["u-maria"] || {}).hour === 10 && /В дни твоих смен по графику, в 10:00/.test(await tgText(a.page)));
  await a.page.locator('[data-mo-day="all"]').click(); await sleep(900);
  await a.page.locator('[data-mo-hour="11"]').click(); await sleep(900);
  ok("HOUR: «Каждый день», потом 11:00 — выбор дней остался", (srv.S.morning["u-maria"] || {}).shift === false && (srv.S.morning["u-maria"] || {}).hour === 11
    && (await pressed(a.page)) === "all" && /Каждое утро в 11:00/.test(await tgText(a.page)), JSON.stringify(srv.S.morning["u-maria"]));
  await a.ctx.close();
});

await run("OFFSW", async () => {
  const srv = srvOf({ off: true });
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  await a.page.locator("[data-mo-on]").click(); await sleep(900);
  ok("OFFSW: выключила — выбора дней и пояснения нет", (await a.page.locator("[data-mo-day]").count()) === 0 && (await a.page.locator("[data-mo-today]").count()) === 0
    && /Выключено: сводка только здесь/.test(await tgText(a.page)));
  await a.page.locator("[data-mo-on]").click(); await sleep(900);
  ok("OFFSW: включила — выбор и пояснение снова", (await a.page.locator("[data-mo-day]").count()) === 2 && (await a.page.locator('[data-mo-today="off"]').count()) === 1);
  await a.ctx.close();
});

await run("MISSING", async () => {
  const srv = srvOf({ no75: true });
  const a = await open({ who: MARIA, srv });
  await toMorning(a.page);
  ok("MISSING: этапа 75 нет — выбора дней нет, подпись прежняя", (await a.page.locator("[data-mo-days]").count()) === 0 && (await a.page.locator("[data-mo-today]").count()) === 0
    && /Каждое утро в 9:00 по часам заведения/.test(await tgText(a.page)));
  await a.ctx.close();
});

await run("FAIL", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, rpcs: (fn) => (fn === "morning_shift_set" ? { ok: false, error: "db" } : undefined) });
  await toMorning(a.page);
  await a.page.locator('[data-mo-day="all"]').click(); await sleep(900);
  const n = await txt(a.page.locator("[data-mo-note]"));
  ok("FAIL: не сохранилось — выбор вернулся, «Не сохранилось. Попробуй ещё раз.»", (await pressed(a.page)) === "shift" && n === "Не сохранилось. Попробуй ещё раз.", n);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf({ off: true });
  const a = await open({ who: MARIA, srv, light: true });
  await toMorning(a.page);
  const s = await a.page.evaluate(() => { const b = document.querySelector('[data-mo-day="shift"]'), n = document.querySelector("[data-mo-today]"); return b && n ? [getComputedStyle(b).borderTopColor, getComputedStyle(n).color] : null; });
  ok("PAPER: «Для чтения» — выбор и пояснение видны (золото бумаги, серый текст)", !!s && s[0] === "rgb(122, 93, 42)" && s[1] !== "rgb(0, 0, 0)", JSON.stringify(s));
  await shot(a.page, "paper");
  await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf({ off: true });
  const a = await open({ who: MARIA, srv, w: 320, h: 700 });
  await toMorning(a.page);
  await a.page.locator('[data-mo-sec="tg"]').scrollIntoViewIfNeeded();
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
