// e2e v105 (Доп. 418): линза в переписке. Владелец (29.10, снимок «Вся команда»): «может, в чат линзу интегрируем?».
// Сервер — tools/claude/demo-app/fake-server.js (как у e2e-v97). Разделы:
//   BUBBLES — чужие пузыри: тёмное стекло, золотой ободок, блик сверху; свои — золото с бликом и светлым ободком; текст
//             прежний (цвет, кегль); хвостик продолжает ободок: у края пузыря над хвостиком — заливка, а не ободок
//             (шва нет, и у «тебя упомянули» тоже);
//   CARDS   — карточки и вызов — стекло с бликом; «Иду», «Забрать» — стеклянные плашки с кольцом; «Отменить» — прежняя;
//   DAY     — «Сегодня» и «Показать раньше» — плашки с ободком и кольцом;
//   FIELDS  — строка ввода — стекло с ободком (в фокусе ободок ярче), поле «Номер стола», подсказки «@» — стекло;
//   PAPER   — «Для чтения»: то же светлым стеклом, ободок тёмным золотом, шва нет;
//   NOW     — «как сейчас»: пузыри, карточки и поля прежние (у «тебя упомянули» шов — как было); раскладка в обоих видах
//             одна и та же (пузыри и карточки на тех же местах и тех же размеров); NARROW — 320 px без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v105.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5297, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v105";
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

// ── переписка, как на снимке владельца: свои с упоминаниями и ответами, чужие, «Опаздываю», «тебя упомянули» ──
function conv(srv, { call = false, give = false, many = 0 } = {}) {
  const team = srv.teamOf(R0).id;
  const send = (p, body, reply = null) => srv.rpc("chat_send", { p_token: tok(p), p_chat: team, p_body: body, p_reply: reply }).msg;
  for (let i = 0; i < many; i++) srv.bot.say(i % 2 ? "e-ilya" : "e-olga", "Сообщение " + (i + 1));
  const m0 = srv.bot.say("u-maria", "Доброе утро! Сегодня банкет на 12 человек в 19:00.");
  srv.rpc("chat_react", { p_token: tok(PETR), p_msg: m0.id, p_r: "ok" });
  if (call) srv.rpc("chat_call", { p_token: tok(MARIA), p_chat: team, p_who: "waiter", p_why: "table", p_table: "5" });
  if (give) srv.bot.offer("e-vera", D(2), "give", "Нужно к врачу");
  const m1 = send(ANNA, "@Пётр Привет) Сегодня получится выйти?");
  const m2 = send(PETR, "Привет) Сегодня не смогу", m1.id);
  send(ANNA, "Очень жаль", m2.id);
  srv.rpc("chat_late", { p_token: tok(ANNA), p_chat: null, p_min: 45, p_note: "Я в пробке" });
  send(PETR, "@Анна Принято, спасибо");
  send(ANNA, "Хорошо", m2.id);
  return team;
}
const toBottom = async (page) => { await page.evaluate(() => { const c = document.querySelector("[data-chat] .ch-chat"); if (c) c.scrollTop = c.scrollHeight; }); await sleep(500); };
const toTop = async (page) => { await page.evaluate(() => { const c = document.querySelector("[data-chat] .ch-chat"); if (c) c.scrollTop = 0; }); await sleep(500); };
const bubbles = (page) => page.evaluate(() => [...document.querySelectorAll("[data-chat] .ch-b, [data-chat] .ch-card, [data-chat] .ch-call")].filter((e) => e.getClientRects().length).map((el) => {
  const r = el.getBoundingClientRect(), s = getComputedStyle(el), b = getComputedStyle(el, "::before"), a = getComputedStyle(el, "::after"), row = el.closest(".ch-row");
  return { kind: el.classList.contains("ch-b") ? (el.classList.contains("ch-out") ? "out" : "in") : "card", tail: !!(row && row.classList.contains("tail")), atme: !!(row && row.classList.contains("atme")),
    text: el.innerText.replace(/\s+/g, " ").slice(0, 30), x: r.x, y: r.y, w: r.width, h: r.height, img: s.backgroundImage, shadow: s.boxShadow, color: s.color, fs: s.fontSize,
    bMask: b.webkitMaskImage || b.maskImage || "", bImg: b.backgroundImage, aContent: a.content, aMask: a.webkitMaskImage || a.maskImage || "", aTf: a.transform };
}));
// цвет точек снимка экрана (CSS px; снимок — 2×): отдельная пустая страница рисует снимок на холсте
async function pixels(page, pts) {
  const buf = await page.screenshot();
  const pg = await browser.newPage();
  const res = await pg.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return pts.map((p) => [...g.getImageData(Math.floor(p.x * 2), Math.floor(p.y * 2), 1, 1).data].slice(0, 3));
  }, { b64: buf.toString("base64"), pts });
  await pg.close();
  return res;
}
const near = (p, q, d = 10) => p && q && p.every((v, i) => Math.abs(v - q[i]) <= d);
// у края пузыря над хвостиком (0,75 px от края, 6 px над низом) и внутри (6 px от края): без шва — один цвет
async function seam(page, b) {
  const y = b.y + b.h - 6, [edge, inside] = await pixels(page, [{ x: b.x + 0.75, y }, { x: b.x + 6, y }]);
  return { edge, inside, same: near(edge, inside) };
}
const has = (s, frag) => String(s || "").includes(frag);
let LAYOUT = null;   // раскладка в виде «Линза» (BUBBLES) — NOW сверяет «как сейчас» с ней

await run("BUBBLES", async () => {
  const srv = newServer({ seed: false }); conv(srv);
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page); await toBottom(a.page);
  const all = await bubbles(a.page), ins = all.filter((x) => x.kind === "in"), outs = all.filter((x) => x.kind === "out");
  LAYOUT = all;
  ok("BUBBLES: чужие пузыри — стекло: свет сверху, золотой ободок, блик; текст прежний (цвет, 15,5 px)", ins.length >= 3 && ins.every((x) => /radial-gradient/.test(x.img)
    && (x.atme || has(x.shadow, "rgba(214, 178, 102, 0.3) 0px 0px 0px 1px inset")) && has(x.shadow, "rgba(255, 255, 255, 0.07) 0px 1.5px 0px 0px inset")
    && x.color === "rgb(241, 232, 214)" && x.fs === "15.5px"), JSON.stringify(ins[0]));
  ok("BUBBLES: свои — золото с бликом и светлым ободком, тёмный текст прежний", outs.length >= 3 && outs.every((x) => /radial-gradient/.test(x.img) && /linear-gradient/.test(x.img)
    && has(x.shadow, "rgba(255, 244, 214, 0.42) 0px 0px 0px 1px inset") && x.color === "rgb(30, 20, 8)"), JSON.stringify(outs[0]));
  const tin = ins.filter((x) => x.tail), tout = outs.filter((x) => x.tail);
  ok("BUBBLES: хвостик — ободок (маска с краем) и заливка поверх (маска на 1 px внутрь); у своих — зеркально", tin.length >= 2 && tout.length >= 1
    && [...tin, ...tout].every((x) => has(x.bMask, "H7V0z") && /linear-gradient/.test(x.bImg) && x.aContent === '""' && has(x.aMask, "H11v-4H7z"))
    && tout.every((x) => x.aTf === "matrix(-1, 0, 0, 1, 0, 0)"), JSON.stringify(tin[0] && { b: tin[0].bMask.slice(-60), a: tin[0].aMask.slice(-60) }));
  const me = ins.find((x) => x.atme);
  ok("BUBBLES: «тебя упомянули» — ободок ярче", !!me && has(me.shadow, "rgba(228, 200, 140, 0.78) 0px 0px 0px 1px inset"), JSON.stringify(me && me.shadow));
  const s1 = await seam(a.page, me), s2 = await seam(a.page, tin.find((x) => !x.atme));
  ok("BUBBLES: шва у хвостика нет: у края пузыря над хвостиком — заливка (и у «тебя упомянули»)", s1.same && s2.same, JSON.stringify({ s1, s2 }));
  await shot(a.page, "lens-dark");
  const [e1, e2] = noErr(a); ok("BUBBLES: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("CARDS", async () => {
  const srv = newServer({ seed: false }); conv(srv, { call: true, give: true });
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page); await toTop(a.page);
  const cards = (await bubbles(a.page)).filter((x) => x.kind === "card");
  ok("CARDS: карточки и вызов — стекло с бликом сверху", cards.length >= 3 && cards.every((x) => /radial-gradient/.test(x.img) && has(x.shadow, "rgba(255, 255, 255, 0.07) 0px 1.5px 0px 0px inset")), JSON.stringify(cards.map((x) => x.text)));
  const go = await st(a.page, "[data-chat] .ch-call .ch-go"), take = await st(a.page, "[data-chat] [data-chat-take]");
  ok("CARDS: «Иду» — стеклянная плашка с кольцом, надпись золотом", go.length === 1 && glassMain(go[0], "rgb(232, 201, 131)"), JSON.stringify(go[0]));
  ok("CARDS: «Забрать» — так же", take.length === 1 && glassMain(take[0], "rgb(232, 201, 131)"), JSON.stringify(take[0]));
  const tile = await a.page.evaluate(() => getComputedStyle(document.querySelector("[data-chat] .ch-card .ch-card-tile")).boxShadow);
  ok("CARDS: золотой корешок — с бликом", has(tile, "rgba(255, 255, 255, 0.6) 0px 1.5px 0px 0px inset"), tile);
  await shot(a.page, "cards");
  await a.ctx.close();
  // у своей карточки — «Отменить» (вторичная кнопка): прежняя, без стекла и кольца
  const v = await open({ who: VERA, srv });
  await openTeam(v.page); await toTop(v.page);
  const gh = await st(v.page, "[data-chat] [data-chat-shift-cancel]");
  ok("CARDS: «Отменить» — прежняя (контур, без стекла и кольца)", gh.length >= 1 && gh[0].bg === "rgba(0, 0, 0, 0)" && gh[0].img === "none" && gh[0].after === "none", JSON.stringify(gh[0]));
  const [e1, e2] = noErr(a, v); ok("CARDS: без ошибок", e1, e2);
  await v.ctx.close();
});

await run("DAY", async () => {
  const srv = newServer({ seed: false }); conv(srv, { many: 66 });
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page); await toTop(a.page);
  const day = await st(a.page, "[data-chat] .ch-day"), more = await st(a.page, "[data-chat] .ch-more");
  ok("DAY: «Сегодня» — плашка с ободком и кольцом", day.length >= 1 && /inset/.test(day[0].shadow) && day[0].after === '""' && day[0].inset === "-3.5px" && day[0].abr === "15.5px", JSON.stringify(day[0]));
  ok("DAY: «Показать раньше» — стекло с ободком и кольцом", more.length === 1 && more[0].bg === "rgba(200, 169, 110, 0.12)" && more[0].after === '""' && more[0].abr === "999px", JSON.stringify(more[0]));
  await shot(a.page, "day");
  await a.ctx.close();
});

await run("FIELDS", async () => {
  const srv = newServer({ seed: false }); conv(srv);
  const a = await open({ who: ANNA, srv });
  await openTeam(a.page);
  const inp = await st(a.page, "[data-chat] textarea.ch-input");
  ok("FIELDS: строка ввода — стекло с ободком", inp.length === 1 && inp[0].bg === "rgba(200, 169, 110, 0.12)" && /rgba\(214, 178, 102, 0\.45\) 0px 0px 0px 1px inset/.test(inp[0].shadow), JSON.stringify(inp[0]));
  await a.page.locator("[data-chat] textarea.ch-input").first().click(); await sleep(300);
  const foc = await a.page.evaluate(() => { const e = document.querySelector("[data-chat] textarea.ch-input"); const s = getComputedStyle(e); return { f: document.activeElement === e, sh: s.boxShadow, bc: s.borderTopColor }; });
  ok("FIELDS: в фокусе ободок ярче, рамки нет", foc.f && has(foc.sh, "rgb(232, 201, 131) 0px 0px 0px 1px inset") && foc.bc === "rgba(0, 0, 0, 0)", JSON.stringify(foc));
  await a.page.locator("[data-chat] textarea.ch-input").first().fill("@"); await sleep(600);
  const mc = await st(a.page, "[data-chat] .ch-mc");
  ok("FIELDS: подсказки «@» — стекло с ободком", mc.length >= 2 && mc.every((x) => x.bg === "rgba(200, 169, 110, 0.12)" && /inset/.test(x.shadow)), mc.length + " " + JSON.stringify(mc[0]));
  await shot(a.page, "mention");
  await a.page.locator("[data-chat] textarea.ch-input").first().fill(""); await sleep(300);
  await a.page.locator("[data-chat-callbtn]").first().click(); await sleep(900);
  await a.page.locator(".ch-sheet .ch-chip").filter({ hasText: /к столу/i }).first().click().catch(() => {}); await sleep(500);
  const fld = await st(a.page, ".ch-sheet .ch-field");
  ok("FIELDS: поле листа («Номер стола») — стекло с ободком", fld.length >= 1 && fld.every((x) => x.bg === "rgba(200, 169, 110, 0.12)" && /inset/.test(x.shadow)), JSON.stringify(fld[0]));
  await shot(a.page, "call-sheet");
  const [e1, e2] = noErr(a); ok("FIELDS: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = newServer({ seed: false }); conv(srv, { call: true });
  const a = await open({ who: ANNA, srv, light: true });
  await openTeam(a.page); await toBottom(a.page);
  const all = await bubbles(a.page), ins = all.filter((x) => x.kind === "in"), outs = all.filter((x) => x.kind === "out");
  ok("PAPER: «Для чтения» — чужие пузыри: ободок тёмным золотом, текст прежний", ins.length >= 3 && ins.every((x) => /radial-gradient/.test(x.img)
    && (x.atme || has(x.shadow, "rgba(139, 106, 48, 0.3) 0px 0px 0px 1px inset")) && x.color === "rgb(42, 31, 14)" && x.fs === "17px"), JSON.stringify(ins[0]));
  ok("PAPER: свои — золото со светлым ободком", outs.length >= 3 && outs.every((x) => has(x.shadow, "rgba(255, 248, 226, 0.55) 0px 0px 0px 1px inset")), JSON.stringify(outs[0]));
  const me = ins.find((x) => x.atme), s = me && await seam(a.page, me);
  ok("PAPER: у «тебя упомянули» шва у хвостика нет", !!s && s.same, JSON.stringify(s));
  await shot(a.page, "lens-light");
  await toTop(a.page);
  const go = await st(a.page, "[data-chat] .ch-call .ch-go");
  ok("PAPER: «Иду» — светлое стекло, надпись тёмным золотом, кольцо", go.length === 1 && glassMain(go[0], "rgb(138, 101, 36)"), JSON.stringify(go[0]));
  await a.ctx.close();
});

await run("NOW", async () => {
  const srv = newServer({ seed: false }); conv(srv);
  const a = await open({ who: ANNA, srv, seedExtra: { sa_home_look: "now" } });
  await openTeam(a.page); await toBottom(a.page);
  const all = await bubbles(a.page), ins = all.filter((x) => x.kind === "in"), outs = all.filter((x) => x.kind === "out");
  ok("NOW: «как сейчас» — пузыри прежние (тёмный без света и ободка, золото без блика), хвостик одной маской",
    ins.every((x) => x.img === "none" && (x.atme || x.shadow === "rgba(0, 0, 0, 0.3) 0px 1px 2px 0px")) && outs.every((x) => !/radial/.test(x.img) && x.shadow === "rgba(0, 0, 0, 0.32) 0px 1px 2px 0px")
    && all.filter((x) => x.tail).every((x) => x.aContent === "none" && !has(x.bMask, "H7V0z")), JSON.stringify({ i: ins[0], o: outs[0] }));
  const me = ins.find((x) => x.atme), s = me && await seam(a.page, me);
  ok("NOW: у «тебя упомянули» над хвостиком кромка, как было (проверка шва чувствительна)", !!s && !s.same, JSON.stringify(s));
  // время в карточке «Опаздываю» идёт своим ходом — сверяем вид и место, не текст
  const geo = (x, x0) => [x.kind, Math.round(x.x * 2) / 2, Math.round(x.w * 2) / 2, Math.round(x.h * 2) / 2, Math.round((x.y - x0.y) * 2) / 2];
  const diff = LAYOUT ? all.map((x, i) => [geo(x, all[0]), LAYOUT[i] && geo(LAYOUT[i], LAYOUT[0])]).filter(([p, q]) => !q || p.some((v, j) => (typeof v === "number" ? Math.abs(v - q[j]) > 0.5 : v !== q[j]))) : [];
  ok("NOW: раскладка та же, что в «Линзе»: пузыри и карточки на тех же местах и тех же размеров", !LAYOUT || (LAYOUT.length === all.length && !diff.length), JSON.stringify({ n: all.length, L: LAYOUT && LAYOUT.length, diff: diff.slice(0, 3) }));
  const inp = await st(a.page, "[data-chat] textarea.ch-input");
  ok("NOW: строка ввода прежняя (рамка, без ободка)", inp.length === 1 && inp[0].shadow === "none", JSON.stringify(inp[0]));
  await shot(a.page, "now-dark");
  await a.ctx.close();
  const b = await open({ who: ANNA, srv, light: true, seedExtra: { sa_home_look: "now" } });
  await openTeam(b.page); await toBottom(b.page); await shot(b.page, "now-light");
  await b.ctx.close();
});

await run("NARROW", async () => {
  const srv = newServer({ seed: false }); conv(srv, { call: true, give: true });
  const a = await open({ who: ANNA, srv, w: 320, h: 700 });
  await openTeam(a.page); await toTop(a.page);
  // только слой чата: круги-отсветы фона главной под ним выходят за край и раньше (обрезаны родителем)
  const f = await a.page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("[data-chat] *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map((e) => String(e.className).slice(0, 30) || e.tagName); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
  ok("NARROW: 320 px — без сдвига вбок (кольца кнопок в карточках)", f.sw <= f.W && f.n === 0, JSON.stringify(f));
  await shot(a.page, "narrow");
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
