// e2e v111 (Доп. 424): линза на новых экранах. Владелец (30.10) после «было / стало» v110: «Мы можем в них интегрировать линзы?».
// В виде «Линза» (по умолчанию) — тем же языком, что главная и чат. Сервер — tools/claude/demo-app/fake-server.js (как e2e-v110). Разделы:
//   MORNING — «Утро руководителя»: кружки строк — линзы с ободком цвета строки, отметка «!» поверх кольца; карточки — стекло со
//             светом; «Собрать брифинг» — плашка с кольцом; «Обновить» — стекло без кольца; выбор часа — прежний;
//   NEWBIES — «Новички»: кружки с инициалами — линзы, «Подтвердить» — ободок ярче, «Добавить новичка» — плашка с кольцом; плашки тем
//             и «Убрать из новичков» — прежние; лист «Наставник»: «закрыть» — линза 32 px, поиск — стекло, в фокусе ярче;
//   WEEK    — «Первая неделя»: раздел «сейчас» — золотая кромка, «сейчас» — стекло; галочки шагов и полоска — прежние;
//   PEER    — «Спасибо от коллег»: «Сказать спасибо коллеге» — плашка с кольцом, инициалы — линзы;
//   GAIN    — «Что дало обучение»: выбранный месяц — плашка с кольцом, другой — стекло; инициалы — линзы;
//   HUBS    — вкладки: значки кнопок-групп — линзы 38 px, счётчик поверх кольца; строки внутри — без кружков; живые карточки — стекло
//             со светом; на компьютере — плитки со светом, значки без кружков;
//   PAPER   — «Для чтения»: тёмное золото; NOW — вид «как сейчас»: всё прежнее; NARROW — 320 px: без сдвига вбок, кольца не срезаны.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v111.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v111";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v111";
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

// стиль элемента и его ::after (кольцо линзы)
const st = (page, sel) => page.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return null;
  const s = getComputedStyle(e), a = getComputedStyle(e, "::after"), r = e.getBoundingClientRect();
  return { bg: s.backgroundColor, img: s.backgroundImage, bc: s.borderTopColor, bw: s.borderTopWidth, sh: s.boxShadow, color: s.color, fw: s.fontWeight, rad: s.borderTopLeftRadius,
    ring: a.content !== "none" && a.content !== "normal" ? a.borderTopColor : "", w: Math.round(r.width), h: Math.round(r.height) };
}, sel);
const HI = "rgb(232, 201, 131)", GOLD_L = "rgb(200, 169, 110)", GLASS = "rgba(200, 169, 110, 0.12)", RING = "rgba(214, 178, 102, 0.44)", EDGE = "rgba(214, 178, 102, 0.3)";
const lensCard = (x) => !!x && /radial-gradient/.test(x.img) && x.bc === EDGE;
const isMain = (x) => !!x && /radial-gradient/.test(x.img) && x.color === HI && x.ring === RING && x.rad === "999px";
const isSoft = (x) => !!x && x.bg === GLASS && /inset/.test(x.sh) && !x.ring && x.rad === "999px";
const isPerson = (x) => !!x && x.img === "none" && x.bg === GLASS && x.color === GOLD_L && x.ring === RING;
// в точке элемента — он сам (его не закрывает кольцо соседа)
const onTop = (page, sel) => page.evaluate((sel) => { const k = document.querySelector(sel); if (!k) return "нет"; const r = k.getBoundingClientRect();
  const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e === k || k.contains(e)) ? "да" : (e ? e.tagName + "." + (e.getAttribute("data-hub-ic") != null ? "ic" : "") : "ничего"); }, sel);

await run("MORNING", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "morning", 1500);
  await ready(m.page, "data-morning"); await sleep(400);
  ok("MORNING: вид «Линза» по умолчанию (html.sa-lens)", await m.page.evaluate(() => document.documentElement.classList.contains("sa-lens")));
  const w = await st(m.page, '[data-mo-row="brief"] [data-glyph]');
  ok("MORNING: кружок «брифинг не собран» — линза: стекло, янтарный ободок и кольцо снаружи", !!w && w.bc === "rgba(0, 0, 0, 0)" && w.sh.includes("rgba(228, 179, 106, 0.55) 0px 0px 0px 1px inset")
    && w.ring === "rgba(228, 179, 106, 0.42)" && w.bg === "rgba(228, 179, 106, 0.1)", JSON.stringify(w));
  const i = await st(m.page, '[data-mo-row^="sh-"] [data-glyph]');
  ok("MORNING: кружок смены (сведения) — золотой ободок и кольцо", !!i && i.sh.includes("rgba(214, 178, 102, 0.55) 0px 0px 0px 1px inset") && i.ring === "rgba(214, 178, 102, 0.42)", JSON.stringify(i));
  ok("MORNING: отметка «!» — поверх кольца", (await onTop(m.page, '[data-mo-row="brief"] [data-glyph-mark]')) === "да");
  const c = await st(m.page, '[data-mo-sec="today"]');
  ok("MORNING: карточки — стекло со светом слева сверху и золотой кромкой", lensCard(c), JSON.stringify(c));
  const b = await st(m.page, "[data-mo-brief]");
  ok("MORNING: «Собрать брифинг» — стеклянная плашка с кольцом, надпись золотом", isMain(b), JSON.stringify(b));
  const a = await st(m.page, "[data-mo-again]");
  ok("MORNING: «Обновить» — стекло с ободком, без кольца", isSoft(a), JSON.stringify(a));
  const hr = await st(m.page, "[data-mo-hour]");
  ok("MORNING: выбор часа и переключатель — прежние (без линзы)", !!hr && hr.sh === "none" && !hr.ring && (await st(m.page, "[data-mo-on]")).sh === "none", JSON.stringify(hr));
  await shot(m.page, "morning");
  const [e1, e2] = noErr(m); ok("MORNING: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("NEWBIES", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "newbies", 1500);
  await ready(m.page, "data-newbies"); await sleep(300);
  const av = await st(m.page, '[data-nbl-item="e-ksenia"] [data-lens="person"]');
  ok("NEWBIES: кружок «КМ» — линза: стекло, инициалы золотом, кольцо", isPerson(av), JSON.stringify(av));
  ok("NEWBIES: карточка новичка — стекло со светом", lensCard(await st(m.page, '[data-nbl-item="e-ksenia"]')));
  const add = await st(m.page, "[data-nbl-add]");
  ok("NEWBIES: «Добавить новичка из команды» — плашка с кольцом", isMain(add), JSON.stringify(add));
  const chip = await st(m.page, '[data-nbl-item="e-ksenia"] [data-nbl-focus] span');
  ok("NEWBIES: плашки тем — прежние", !!chip && chip.sh === "none" && chip.bg === "rgba(214, 178, 102, 0.1)", JSON.stringify(chip));
  await m.page.locator('[data-nbl-item="e-ksenia"] [role=button]').first().click(); await sleep(600);
  const cf = await st(m.page, '[data-nbl-confirm="d2c"][data-nbl-emp="e-ksenia"]'), ch = await st(m.page, '[data-nbl-buddy="e-ksenia"]');
  ok("NEWBIES: «Подтвердить» — стекло с ярким ободком, «Сменить» — стекло", !!cf && cf.bg === GLASS && cf.sh.includes(HI + " 0px 0px 0px 1px inset") && !cf.ring && isSoft(ch), JSON.stringify(cf) + " " + JSON.stringify(ch));
  const off = await st(m.page, '[data-nbl-off="e-ksenia"]');
  ok("NEWBIES: «Убрать из новичков» — прежняя (без линзы)", !!off && off.bg === "rgba(0, 0, 0, 0)" && off.sh === "none", JSON.stringify(off));
  await shot(m.page, "newbies-open");
  await m.page.locator('[data-nbl-buddy="e-ksenia"]').click(); await sleep(700);
  const x = await st(m.page, '[data-nb-sheet="buddy"] [data-nb-x]');
  ok("NEWBIES: лист «Наставник» — «закрыть» линзой 32 px", !!x && x.w === 32 && x.h === 32 && x.bg === GLASS && x.ring === RING, JSON.stringify(x));
  const s0 = await st(m.page, "[data-nb-search]");
  await m.page.locator("[data-nb-search]").focus(); await sleep(200);
  const s1 = await st(m.page, "[data-nb-search]");
  ok("NEWBIES: поиск — стекло с ободком, в фокусе ободок ярче", !!s0 && s0.bg === GLASS && s0.sh.includes("rgba(214, 178, 102, 0.45) 0px 0px 0px 1px inset") && s1.sh.includes(HI + " 0px 0px 0px 1px inset"),
    JSON.stringify(s0) + " → " + JSON.stringify(s1));
  ok("NEWBIES: в листе кружки людей — линзы", isPerson(await st(m.page, '[data-nb-sheet="buddy"] [data-nb-pick] [data-lens="person"]')));
  await shot(m.page, "buddy-sheet");
  const [e1, e2] = noErr(m); ok("NEWBIES: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("WEEK", async () => {
  const srv = srvOf();
  const k = await open({ who: KSENIA, srv });
  await nav(k.page, "newbie", 1500);
  await ready(k.page, "data-newbie"); await sleep(300);
  const now = await st(k.page, '[data-nb-now="1"] [data-lens-card="hi"]'), other = await st(k.page, '[data-nb-sec="d2"] [data-lens-card]');
  ok("WEEK: раздел «сейчас» — стекло со светом и золотой кромкой ярче, остальные — обычная кромка", !!now && /radial-gradient/.test(now.img) && now.bc === HI && lensCard(other),
    JSON.stringify(now) + " " + JSON.stringify(other));
  const tag = await st(k.page, "[data-lens-tag]");
  ok("WEEK: «сейчас» — стекло с ободком", !!tag && tag.bg === GLASS && /inset/.test(tag.sh), JSON.stringify(tag));
  const chk = await st(k.page, '[data-nb-step="d1a"] > span');
  ok("WEEK: галочки шагов — прежние (золотой ободок, без линзы)", !!chk && chk.sh === "none" && !chk.ring && /rgba\(217, 184, 124/.test(chk.bc), JSON.stringify(chk));
  ok("WEEK: «Открыть» у тем с собеседования — стекло", isSoft(await st(k.page, "[data-nb-open]")));
  await shot(k.page, "week");
  // у Тимура наставник назначен (Илья): кружок «ИБ» — линза, «Написать» — стекло
  const t = await open({ who: TIMUR, srv });
  await nav(t.page, "newbie", 1500);
  await ready(t.page, "data-newbie"); await sleep(300);
  const bav = await st(t.page, '[data-nb-sec="buddy"] [data-lens="person"]'), bdm = await st(t.page, "[data-nb-dm]");
  ok("WEEK: наставник — кружок линзой, «Написать» — стекло", isPerson(bav) && isSoft(bdm), JSON.stringify(bav) + " " + JSON.stringify(bdm));
  const [e1, e2] = noErr(k, t); ok("WEEK: без ошибок", e1, e2);
  await k.ctx.close(); await t.ctx.close();
});

await run("PEER", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "peerThanks", 1500);
  await ready(a.page, "data-peer"); await sleep(300);
  const say = await st(a.page, "[data-peer-say]");
  ok("PEER: «Сказать спасибо коллеге» — плашка с кольцом", isMain(say), JSON.stringify(say));
  ok("PEER: карточки — стекло со светом, кружок «МК» — линза", lensCard(await st(a.page, "[data-peer-stats]")) && lensCard(await st(a.page, "[data-peer-item]"))
    && isPerson(await st(a.page, '[data-peer-item] [data-lens="person"]')));
  await shot(a.page, "peer");
  const [e1, e2] = noErr(a); ok("PEER: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("GAIN", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "gain", 1500);
  await ready(m.page, "data-gain"); await sleep(400);
  const sel = await st(m.page, '[data-gain-month][aria-pressed="true"]'), other = await st(m.page, '[data-gain-month][aria-pressed="false"]');
  ok("GAIN: выбранный месяц — плашка с кольцом, другой — стекло без кольца", isMain(sel) && isSoft(other), JSON.stringify(sel) + " " + JSON.stringify(other));
  const gl = await st(m.page, '[data-gain-sec="learn"]'), gh = await st(m.page, '[data-gain-sec="hall"]'), gp = await st(m.page, '[data-gain-sec="grew"] [data-lens="person"], [data-gain-sec="idle"] [data-lens="person"]');
  ok("GAIN: карточки — стекло со светом; инициалы — линзы", lensCard(gl) && lensCard(gh) && isPerson(gp), JSON.stringify([gl, gh, gp]));
  ok("GAIN: «Напомнить» и «Прислать этот итог в Telegram» — стекло", isSoft(await st(m.page, "[data-gain-nudge]")) && isSoft(await st(m.page, "[data-gain-send]")));
  // v126: 1-го числа сразу открыт прошлый месяц (итог закончившегося) — плашка на втором; ждём переезд на другой, какой бы ни был
  const before = await m.page.evaluate(() => [...document.querySelectorAll("[data-gain-month]")].map((b) => b.getAttribute("aria-pressed")).join(","));
  await m.page.locator('[data-gain-month][aria-pressed="false"]').click(); await sleep(1200);
  const sel2 = await m.page.evaluate(() => [...document.querySelectorAll("[data-gain-month]")].map((b) => b.getAttribute("aria-pressed") + ":" + b.getAttribute("data-lens-btn")).join(","));
  ok("GAIN: другой месяц — плашка переезжает на него", sel2 === (before === "false,true" ? "true:main,false:soft" : "false:soft,true:main"), before + " → " + sel2);
  await shot(m.page, "gain");
  const [e1, e2] = noErr(m); ok("GAIN: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("HUBS", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, fold: true });
  await nav(m.page, "shift", 1800);
  await until(() => m.page.locator('[data-hub-group="На смене"] [data-hub-badge]').count(), 9000);
  const d = await st(m.page, '[data-hub-group="На смене"] [data-hub-disc]');
  ok("HUBS: значок кнопки-группы — линза 38 px: стекло, ободок, кольцо", !!d && d.w === 38 && d.h === 38 && d.bg === GLASS && d.sh.includes("rgba(214, 178, 102, 0.45) 0px 0px 0px 1px inset") && d.ring === RING, JSON.stringify(d));
  ok("HUBS: счётчик на значке — поверх кольца", (await onTop(m.page, '[data-hub-group="На смене"] [data-hub-badge]')) === "да");
  const fc = await st(m.page, '[data-hub-group="На смене"]');
  ok("HUBS: кнопки-группы — свет сверху и золотая кромка, фон прежний (подписи читаются как в v110)", lensCard(fc) && fc.bg === "rgba(226, 186, 116, 0.09)"
    && lensCard(await st(m.page, '[data-hub-group="Потренироваться"]')), JSON.stringify(fc));
  const live = await m.page.evaluate(() => [...document.querySelectorAll(".sa-pagein.sa-card, [data-brief-card]")].filter((e) => !e.closest("[data-hub-group]")).map((e) => {
    const s = getComputedStyle(e); return (e.getAttribute("data-shift-role") || (e.hasAttribute("data-quest") ? "quest" : e.hasAttribute("data-brief-card") ? "brief" : "card")) + ":" + (/radial-gradient/.test(s.backgroundImage) ? 1 : 0); }));
  ok("HUBS: живые карточки «Смены» (сегодня, роль, квест) — стекло со светом", live.length >= 2 && live.every((x) => x.endsWith(":1")), live.join(" "));
  await m.page.locator('[data-hub-toggle="На смене"]').click(); await sleep(600);
  const rows = await m.page.evaluate(() => [...document.querySelectorAll('[data-hub-group="На смене"] [data-hub-compact] [data-hub-ic]')].map((e) => { const s = getComputedStyle(e); return Math.round(e.getBoundingClientRect().width) + ":" + s.boxShadow; }));
  ok("HUBS: строки внутри группы — значки без кружков, как было", rows.length >= 5 && rows.every((x) => /:none$/.test(x) && parseInt(x, 10) <= 24), rows.slice(0, 3).join(" | "));
  await shot(m.page, "hub-shift-open");
  await nav(m.page, "teamHub", 1600);
  ok("HUBS: «Команда» — лидеры, кнопки-группы и «Работа над ошибками» — стекло со светом, значки — линзы", lensCard(await st(m.page, '[data-hub-group="Управление"]'))
    && lensCard(await st(m.page, "[data-hub-single]")) && (await st(m.page, "[data-hub-single] [data-hub-disc]")).w === 38
    && (await m.page.evaluate(() => [...document.querySelectorAll(".sa-card.sa-pagein")].filter((e) => !e.closest("[data-hub-group]")).every((e) => /radial-gradient/.test(getComputedStyle(e).backgroundImage)))));
  const feed = await m.page.locator("[data-team-feed]").count();
  const fd = feed ? await st(m.page, '[data-feed-item] [data-lens="disc"]') : null;
  ok("HUBS: «Жизнь команды» (если есть) — значки линзами", !feed || (!!fd && fd.bg === GLASS && fd.ring === RING), JSON.stringify(fd));
  await shot(m.page, "hub-team");
  await nav(m.page, "me", 1600);
  ok("HUBS: «Я» — карточка роли и кнопки-группы — стекло со светом", (await m.page.evaluate(() => [...document.querySelectorAll(".sa-card.sa-pagein, [data-hub-group]")].filter((e) => !e.closest("[data-hub-compact]"))
    .every((e) => /radial-gradient/.test(getComputedStyle(e).backgroundImage)))));
  const dk = await open({ who: MARIA, srv, w: 1280, h: 860, mobile: false, fold: true });
  await nav(dk.page, "shift", 1800);
  const tiles = await dk.page.evaluate(() => [...document.querySelectorAll(".sa-hubtiles .sa-card")].map((e) => { const ic = e.querySelector("[data-hub-ic]"); return (/radial-gradient/.test(getComputedStyle(e).backgroundImage) ? 1 : 0) + ":" + (ic ? getComputedStyle(ic).boxShadow : "?"); }));
  ok("HUBS: на компьютере — плитки со светом, значки без кружков", tiles.length > 3 && tiles.every((x) => x === "1:none"), tiles.slice(0, 3).join(" "));
  const k = await open({ who: KSENIA, srv, fold: true });
  await nav(k.page, "shift", 1600);
  await until(() => k.page.locator("[data-nb-hero]").count(), 6000);
  ok("HUBS: новичку — «Первая неделя» в «Смене» стеклом со светом", lensCard(await st(k.page, "[data-nb-hero]")));
  await shot(k.page, "hub-newbie");
  const [e1, e2] = noErr(m, dk, k); ok("HUBS: без ошибок", e1, e2);
  await m.ctx.close(); await dk.ctx.close(); await k.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, light: true });
  await nav(m.page, "morning", 1500);
  await ready(m.page, "data-morning"); await sleep(300);
  const w = await st(m.page, '[data-mo-row="brief"] [data-glyph]');
  ok("PAPER: «Для чтения» — кружок «внимание» с тёмно-янтарным ободком", !!w && w.sh.includes("rgba(139, 90, 18, 0.55) 0px 0px 0px 1px inset") && w.color === "rgb(139, 90, 18)", JSON.stringify(w));
  const b = await st(m.page, "[data-mo-brief]");
  ok("PAPER: «Собрать брифинг» — светлое стекло, надпись тёмным золотом, кольцо", !!b && b.img.includes("rgba(255, 255, 255, 0.85)") && b.color === "rgb(138, 101, 36)" && b.ring === "rgba(139, 106, 48, 0.45)", JSON.stringify(b));
  const c = await st(m.page, '[data-mo-sec="today"]');
  ok("PAPER: карточки — прежнее светлое стекло, свет сверху, кромка тёмным золотом", !!c && c.bg === "rgba(250, 242, 222, 0.6)" && /radial-gradient/.test(c.img) && c.bc === "rgba(139, 106, 48, 0.3)", JSON.stringify(c));
  await shot(m.page, "paper-morning");
  await nav(m.page, "gain", 1500);
  await ready(m.page, "data-gain"); await sleep(300);
  const p = await st(m.page, '[data-gain-sec="grew"] [data-lens="person"], [data-gain-sec="idle"] [data-lens="person"]');
  ok("PAPER: кружки с инициалами — стекло, инициалы тёмным золотом", !!p && p.color === "rgb(122, 93, 42)" && p.bg === "rgba(139, 106, 48, 0.09)", JSON.stringify(p));
  await nav(m.page, "shift", 1500);
  const d = await st(m.page, "[data-hub-disc]");
  ok("PAPER: значок кнопки-группы — светлая линза", !!d && d.bg === "rgba(139, 106, 48, 0.09)" && d.ring === "rgba(139, 106, 48, 0.32)", JSON.stringify(d));
  await shot(m.page, "paper-shift");
  const [e1, e2] = noErr(m); ok("PAPER: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, seedExtra: { sa_home_look: "now" } });
  await nav(m.page, "morning", 1500);
  await ready(m.page, "data-morning"); await sleep(300);
  ok("NOW: вид «как сейчас» — без html.sa-lens", !(await m.page.evaluate(() => document.documentElement.classList.contains("sa-lens"))));
  const w = await st(m.page, '[data-mo-row="brief"] [data-glyph]');
  ok("NOW: кружок строки — прежний: янтарная обводка, без кольца и стекла", !!w && w.bc === "rgb(228, 179, 106)" && w.bw !== "0px" && w.bg === "rgba(214, 178, 102, 0.1)" && !w.ring && w.sh === "none", JSON.stringify(w));
  const b = await st(m.page, "[data-mo-brief]");
  ok("NOW: «Собрать брифинг» — прежнее золото с тёмной надписью", !!b && /linear-gradient/.test(b.img) && b.color === "rgb(26, 16, 8)" && !b.ring, JSON.stringify(b));
  const c = await st(m.page, '[data-mo-sec="today"]');
  ok("NOW: карточки — прежние (без света)", !!c && c.img === "none", JSON.stringify(c));
  await nav(m.page, "newbies", 1500);
  await ready(m.page, "data-newbies"); await sleep(300);
  const av = await st(m.page, '[data-nbl-item] [data-lens="person"]');
  ok("NOW: кружки с инициалами — прежние, золотые", !!av && /linear-gradient/.test(av.img) && av.color === "rgb(255, 255, 255)" && !av.ring, JSON.stringify(av));
  await nav(m.page, "shift", 1500);
  const d = await st(m.page, "[data-hub-disc]");
  ok("NOW: значок кнопки-группы — без кружка, 32 px", !!d && d.w === 32 && d.sh === "none" && !d.ring, JSON.stringify(d));
  await shot(m.page, "now-shift");
  const [e1, e2] = noErr(m); ok("NOW: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, w: 320, h: 700, fold: true });
  const bad = [];
  for (const s of ["shift", "teamHub", "me", "newbies", "morning", "gain"]) {
    await nav(m.page, s, 1800);
    const f = await fits(m.page);
    if (f.sw > f.W || f.n) bad.push(s + ":" + JSON.stringify(f));
    if (s === "shift" || s === "morning") await shot(m.page, "narrow-" + s);
    if (s === "morning") {
      // кольцо «Собрать брифинг» — внутри карточки (не срезано её краем)
      const inCard = await m.page.evaluate(() => { const b = document.querySelector("[data-mo-brief]"), c = b && b.closest("[data-lens-card]"); if (!b || !c) return false;
        const r = b.getBoundingClientRect(), k = c.getBoundingClientRect(); return r.left - 3.5 >= k.left && r.right + 3.5 <= k.right && r.bottom + 3.5 <= k.bottom; });
      ok("NARROW: кольцо «Собрать брифинг» — целиком внутри карточки", inCard);
    }
  }
  ok("NARROW: 320 px — вкладки, «Новички», «Утро», «Что дало обучение» без сдвига вбок", !bad.length, bad.join(" | "));
  await nav(m.page, "shift", 1500);
  const clash = await m.page.evaluate(() => [...document.querySelectorAll("[data-hub-toggle]")].map((b) => {
    const ic = b.querySelector("[data-hub-ic]").getBoundingClientRect(), nm = b.querySelector("[data-hub-name]").getBoundingClientRect(), ch = b.querySelector("svg.sa-hubchev").getBoundingClientRect();
    const bd = b.querySelector("[data-hub-badge]"), bb = bd ? bd.getBoundingClientRect() : null;
    return { g: b.getAttribute("data-hub-toggle"), ok: nm.left >= ic.right + 3.5 && nm.right <= ch.left + 1 && (!bb || bb.right <= nm.left + 1) };
  }));
  ok("NARROW: кнопки-группы — линза со счётчиком, название и стрелка не наезжают друг на друга", clash.length >= 2 && clash.every((x) => x.ok), JSON.stringify(clash));
  await m.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
