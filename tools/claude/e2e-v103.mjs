// e2e v103 (Доп. 416): «Линза» в чате и на белой бумаге. Владелец (29.10, снимки из Telegram): «может эти кружки тоже
// сделаем линзами? В чате я имею в виду» (кружок «Вся команда» в шапке и кружки листа действий) и «ну и эту печать, в
// теме для чтения… как в тёмной» («Начать» в приглашении — сургучная печать на белой бумаге). Сервер —
// tools/claude/demo-app/fake-server.js (как у e2e-v97). Разделы:
//   CHAT   — список чатов: кружки чатов — линзы; «Вся команда»: «назад» в шапке — линза 34 px, кружок чата — линза с
//            золотым значком; лист «+»: кружки «Фото» … «Опаздываю» — линзы, значки золотом; «отправить» — прежнее
//            золото; «Назад» Telegram (помеченное [data-sa-back]) — тот же «назад» шапки;
//   PAPER  — «Для чтения»: на корешке приглашения линза тёмным золотом, сургуча нет; чат — линзы светлого стекла;
//   NOW    — «как сейчас»: на белой бумаге сургуч, в чате кружки — прежнее золото;   NARROW — 320 px: лист «+» помещается.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v103.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5297, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v103";
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
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
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

// ── CHAT: список, шапка, лист «+» ──
await run("CHAT", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv });
  await openChat(a.page);
  const list = await lensOf(a.page, ".ch-ava");
  ok("CHAT: список — кружки чатов линзами (стекло, ободок, кольцо)", list.length >= 3 && list.every((x) => isLens(x)), JSON.stringify(list[0]));
  await a.page.getByText("Вся команда").first().click(); await sleep(1300);
  const back = await lensOf(a.page, "[data-chat] .ch-head .ch-back");
  ok("CHAT: «назад» в шапке — линза 34 px", back.length === 1 && back[0].w === 34 && back[0].h === 34 && isLens(back[0]), JSON.stringify(back[0]));
  const ava = await lensOf(a.page, "[data-chat] .ch-head .ch-ava");
  ok("CHAT: кружок «Вся команда» в шапке — линза, значок золотом", ava.length === 1 && isLens(ava[0]) && ava[0].color === "rgb(200, 169, 110)", JSON.stringify(ava[0]));
  const tgBack = await a.page.evaluate(() => { const m = [...document.querySelectorAll('[data-sa-back], [aria-label="Назад"]')].filter((e) => e.getClientRects().length); return m.map((e) => e.className); });
  ok("CHAT: «Назад» Telegram жмёт тот же «назад» шапки", tgBack.length >= 1 && tgBack.includes("ch-back"), JSON.stringify(tgBack));
  const send = await lensOf(a.page, ".ch-send");
  await a.page.locator("[data-chat-attach]").first().click(); await sleep(800);
  const tiles = await lensOf(a.page, "[data-chat-acts] .ch-tile-i");
  ok("CHAT: лист «+» — все кружки линзами, значки золотом (было золото с тёмным значком)", tiles.length >= 9 && tiles.every((x) => isLens(x) && x.color === "rgb(200, 169, 110)"), tiles.length + " · " + JSON.stringify(tiles[0]));
  await shot(a.page, "chat-acts");
  ok("CHAT: «отправить» — прежнее золото (главное действие)", !send.length || /gradient/.test(send[0].img), JSON.stringify(send[0] || null));
  const [e1, e2] = noErr(a); ok("CHAT: без ошибок", e1, e2);
  await a.ctx.close();
});

// ── PAPER: «Для чтения» — линза вместо сургуча, чат светлым стеклом ──
await run("PAPER", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv, light: true });
  await sleep(800);
  const g = await a.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); if (!c) return null; const l = c.querySelector("[data-now-lens]");
    return { hero: c.getAttribute("data-hero"), seal: !!c.querySelector("[data-now-seal]"), lens: l ? l.getAttribute("data-now-lens") : null, bg: l ? getComputedStyle(l).backgroundColor : null }; });
  ok("PAPER: белая бумага, на корешке линза тёмным золотом, сургуча нет", g && g.hero === "paper" && !g.seal && g.lens === "light" && g.bg === "rgba(139, 106, 48, 0.09)", JSON.stringify(g));
  await shot(a.page, "paper-lens");
  await openChat(a.page);
  await a.page.getByText("Вся команда").first().click(); await sleep(1200);
  await a.page.locator("[data-chat-attach]").first().click(); await sleep(800);
  const tiles = await lensOf(a.page, "[data-chat-acts] .ch-tile-i");
  ok("PAPER: лист «+» — линзы светлого стекла, значки тёмным золотом", tiles.length >= 9 && tiles.every((x) => isLens(x, "rgba(139, 106, 48, 0.09)") && x.color === "rgb(122, 93, 42)"), JSON.stringify(tiles[0]));
  await shot(a.page, "paper-acts");
  const [e1, e2] = noErr(a); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close();
});

// ── NOW: «как сейчас» — сургуч и золотые кружки, как были ──
await run("NOW", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv, light: true, seedExtra: { sa_home_look: "now" } });
  await sleep(800);
  const g = await a.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); return c ? { seal: !!c.querySelector("[data-now-seal]"), lens: !!c.querySelector("[data-now-lens]") } : null; });
  ok("NOW: «как сейчас» — на белой бумаге сургучная печать, как была", g && g.seal && !g.lens, JSON.stringify(g));
  await openChat(a.page);
  await a.page.getByText("Вся команда").first().click(); await sleep(1200);
  await a.page.locator("[data-chat-attach]").first().click(); await sleep(800);
  const tiles = await lensOf(a.page, "[data-chat-acts] .ch-tile-i");
  ok("NOW: в чате кружки листа «+» — прежнее золото, кольца нет", tiles.length >= 9 && tiles.every((x) => /gradient/.test(x.img) && x.after === "none"), JSON.stringify(tiles[0]));
  await a.ctx.close();
});

// ── NARROW: 320 px ──
await run("NARROW", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv, w: 320, h: 640 });
  await openChat(a.page);
  await a.page.getByText("Вся команда").first().click(); await sleep(1200);
  await a.page.locator("[data-chat-attach]").first().click(); await sleep(800);
  // два декоративных слоя чата выходят за край и на v102 (fits: n = 2) — смотрим линзы с кольцом и прокрутку вбок
  const f = await a.page.evaluate(() => { const W = document.documentElement.clientWidth;
    const out = [...document.querySelectorAll("[data-chat-acts] .ch-tile-i")].filter((e) => { const r = e.getBoundingClientRect(); return r.left - 3.5 < 0 || r.right + 3.5 > W; }).length;
    return { W, sw: document.documentElement.scrollWidth, out, n: document.querySelectorAll("[data-chat-acts] .ch-tile-i").length }; });
  ok("NARROW 320: лист «+» с линзами помещается (кольца в экране), без прокрутки вбок", f.n >= 9 && !f.out && f.sw <= f.W + 1, JSON.stringify(f));
  await shot(a.page, "narrow-acts");
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
