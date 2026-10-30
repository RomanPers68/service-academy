// e2e v104 (Доп. 417): линзы в листах чата. Владелец (29.10, запись из Telegram — листы «Задание», «Стоп-лист»,
// «Поменяться»): «по настройкам, в чате… тоже можем линзы сделать, особенно кнопки подтверждения, ну и всё
// остальное?». Сервер — tools/claude/demo-app/fake-server.js (как у e2e-v97). Разделы:
//   SHEETS — «Поменяться», «Задание», «Опаздываю», «Опрос»: кнопка подтверждения (.ch-main) — стеклянная плашка
//            (свет сверху, ободок, кольцо снаружи, надпись золотом); пока не выбрано — бледная; значки строк выбора
//            (.ch-opt-i) — круглые линзы с кольцом; «закрыть» (.ch-x) — линза 32 px; выбранная строка — золотая кромка;
//   SEND   — набран текст: «отправить» — линза;   PAPER — «Для чтения»: то же светлым стеклом, надпись тёмным золотом;
//   NOW    — «как сейчас»: кнопка подтверждения — прежнее золото, значки — скруглённые квадраты.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v104.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5297, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v104";
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

await run("SHEETS", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv });
  await openTeam(a.page);
  await sheet(a.page, "swap");
  const m0 = await st(a.page, ".ch-sheet .ch-main");
  ok("SHEETS: «Поменяться» — пока смена не выбрана, кнопка бледная (стекло, кольцо)", m0.length === 1 && m0[0].dis && Number(m0[0].op) < 0.7 && glassMain(m0[0], "rgb(232, 201, 131)"), JSON.stringify(m0[0]));
  const ics = await st(a.page, ".ch-sheet .ch-opt-i");
  ok("SHEETS: значки смен — круглые линзы с кольцом (были скруглённые квадраты)", ics.length >= 3 && ics.every((x) => lensDisc(x, "rgba(200, 169, 110, 0.12)")), ics.length + " · " + JSON.stringify(ics[0]));
  await a.page.locator(".ch-sheet .ch-opt").first().click(); await sleep(500);
  const m1 = await st(a.page, ".ch-sheet .ch-main");
  const sel = await a.page.evaluate(() => getComputedStyle(document.querySelector('.ch-sheet .ch-opt[aria-pressed="true"]')).borderTopColor);
  ok("SHEETS: выбрал смену — кнопка «Предложить обмен» ожила, стекло с золотой надписью; строка — золотая кромка", m1.length === 1 && !m1[0].dis && m1[0].op === "1" && glassMain(m1[0], "rgb(232, 201, 131)") && /200, 169, 110|214, 178, 102/.test(sel), JSON.stringify({ m: m1[0], sel }));
  const x = await st(a.page, ".ch-sheet .ch-x");
  ok("SHEETS: «закрыть» листа — линза 32 px", x.length === 1 && x[0].w === 32 && lensDisc(x[0], "rgba(200, 169, 110, 0.12)"), JSON.stringify(x[0]));
  await shot(a.page, "swap");
  await closeSheet(a.page);
  for (const act of ["task", "late", "poll"]) {
    await sheet(a.page, act);
    if (act === "task") { await a.page.locator(".ch-sheet .ch-opt").first().click(); await sleep(600); }   // сначала — что пройти
    const m = await st(a.page, ".ch-sheet .ch-main");
    ok(`SHEETS: «${act}» — кнопка подтверждения стеклянная, с кольцом`, m.length >= 1 && m.every((y) => glassMain(y, "rgb(232, 201, 131)")), JSON.stringify(m[0]));
    if (act === "late") await shot(a.page, "late");
    await closeSheet(a.page);
  }
  const [e1, e2] = noErr(a); ok("SHEETS: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("SEND", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv });
  await openTeam(a.page);
  await a.page.locator(".ch-input").first().fill("Проверка"); await sleep(400);
  const s = await st(a.page, "[data-chat-send]");
  ok("SEND: набран текст — «отправить» линза (стекло, кольцо), значок золотом", s.length === 1 && lensDisc(s[0], "rgba(200, 169, 110, 0.12)") && s[0].color === "rgb(232, 201, 131)", JSON.stringify(s[0]));
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv, light: true });
  await openTeam(a.page);
  await sheet(a.page, "late");
  const m = await st(a.page, ".ch-sheet .ch-main");
  ok("PAPER: «Для чтения» — кнопка подтверждения светлым стеклом, надпись тёмным золотом", m.length === 1 && glassMain(m[0], "rgb(138, 101, 36)"), JSON.stringify(m[0]));
  await shot(a.page, "paper-late");
  await closeSheet(a.page);
  await sheet(a.page, "swap");
  const ics = await st(a.page, ".ch-sheet .ch-opt-i");
  ok("PAPER: значки смен — светлые линзы", ics.length >= 3 && ics.every((x) => lensDisc(x, "rgba(139, 106, 48, 0.09)")), JSON.stringify(ics[0]));
  await a.ctx.close();
});

await run("NOW", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv, seedExtra: { sa_home_look: "now" } });
  await openTeam(a.page);
  await sheet(a.page, "swap");
  const m = await st(a.page, ".ch-sheet .ch-main"), ics = await st(a.page, ".ch-sheet .ch-opt-i");
  ok("NOW: «как сейчас» — кнопка подтверждения прежним золотом, значки — скруглённые квадраты без кольца", m.length === 1 && /linear-gradient/.test(m[0].img) && m[0].after === "none" && ics.length >= 3 && ics.every((x) => x.br === "11px" && x.after === "none"), JSON.stringify({ m: m[0], i: ics[0] }));
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
