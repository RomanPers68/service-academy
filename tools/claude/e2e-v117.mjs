// e2e v117 (Доп. 430): «Команда и Я» в линзах. Владелец (30.10): «Пройдёмся по приложению, добьём то, что осталось? Чтобы
// приложение визуально было едино». В виде «Линза» (по умолчанию). Сервер — tools/claude/demo-app/fake-server.js; отчёты по
// сотрудникам — своими ответами сервера (в демо этапа 23 нет). Разделы:
//   ME     — аккаунт: профиль, настройки, «Карта обучения» — карточки, PIN — стекло, «Выйти» — красная капсула; статистика:
//            профиль и роли — карточки, итоги — кромка;
//   RATING — рейтинг: лига, рекорды, люди — карточки, «Сотрудник недели» — кромка со своим градиентом; лига — своя строка;
//   BOOK   — книга отзывов: шапка — карточка, листание — линза, страница — бумага;
//   ADMIN  — аналитика (кромка, свой градиент), сервер («нужно сделать» — жёлтая кромка, «Подключить бота» — плашка);
//   REPORT — отчёты: строки — кромка («Требуют внимания» — своя красная), «Excel по команде» — плашка, «PDF» — стекло,
//            фильтры — стекло, выбранный — плашка, поиск — стекло;
//   EDIT   — редакторы уроков, коктейлей и меню: поля — стекло, главные — плашки, «Отмена» — стекло;
//   PAPER  — «Для чтения»: тёмное золото у стекла, светлые плашки; контраст по пикселям не ниже нормы;
//   NOW    — вид «как сейчас»: аккаунт, сервер и отчёты прежние;
//   NARROW — 320 px: кольца и плашки в экране.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v117.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v117";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v117";
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


const PILL = "rgba(232, 201, 131, 0.62) 0px 0px 0px 1px inset", RIM = "rgba(214, 178, 102, 0.45) 0px 0px 0px 1px inset", HL = "rgba(255, 255, 255, 0.18) 0px 1.5px 0px 0px inset";
const RED = "rgb(224, 120, 120)";
const isEdge = (x) => !!x && x.bc === EDGE && !/radial-gradient/.test(x.img) && x.sh.includes(HL);
const isTab = (x) => !!x && x.color === HI && +x.fw >= 700 && x.sh.includes(PILL);
const isDisc = (x) => !!x && x.bg === GLASS && x.ring === RING && x.sh.includes(RIM);
// пометить элемент по началу текста (для st) — возвращает селектор
const pick = async (page, sel, t) => { const k = "p" + Math.random().toString(36).slice(2, 8);
  const okk = await page.evaluate(([sel, t, k]) => { const e = [...document.querySelectorAll(sel)].find((x) => x.offsetParent !== null && x.textContent.trim().startsWith(t)); if (!e) return false; e.setAttribute("data-e2e", k); return true; }, [sel, t, k]);
  return okk ? `[data-e2e="${k}"]` : "[data-e2e-none]"; };
const ringIn = (page, sels) => page.evaluate((sels) => { const W = document.documentElement.clientWidth;
  return [...document.querySelectorAll(sels)].filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 18), l: r.left - 3.5, r: r.right + 3.5 }; })
    .filter((x) => x.l < 0 || x.r > W); }, sels);

// контраст по пикселям: фон — из снимка элемента (без края), надпись — цвет из CSS
const sharp = require("/home/claude/.npm-global/lib/node_modules/sharp");
const lumA = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const pxRatio = async (page, sel) => {
  const e = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { x: r.left, y: r.top, w: r.width, h: r.height, c: s.color.match(/[\d.]+/g).map(Number).slice(0, 3), fs: parseFloat(s.fontSize), fw: +s.fontWeight || 400, t: el.textContent.trim().slice(0, 20) }; }, sel);
  if (!e) return null;
  await sleep(200);
  const e2 = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: r.top }; }, sel);
  const buf = await page.screenshot({ clip: { x: e2.x + 2, y: e2.y + 2, width: Math.max(2, e.w - 4), height: Math.max(2, e.h - 4) } });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const px = []; for (let i = 0; i < data.length; i += info.channels) px.push([data[i], data[i + 1], data[i + 2]]);
  px.sort((a, b) => lumA(a) - lumA(b));
  const bg = lumA(e.c) < 0.18 ? px[Math.floor(px.length * 0.7)] : px[Math.floor(px.length * 0.3)];
  const x = lumA(e.c), y = lumA(bg), r = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  return { t: e.t, r: +r.toFixed(2), need: e.fs >= 18.66 || (e.fw >= 700 && e.fs >= 14) ? 3 : 4.5 };
};

// свет карточки (радиальный, у левого верхнего угла, до 70 px вниз) под каждой надписью карточки: где без света норма
// (4,5; крупные и полужирные от 14 px — 3) выполнялась, со светом она тоже должна выполняться
const LIGHT_AUDIT = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const parse = (s) => { const m = String(s).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const L = parse(getComputedStyle(document.documentElement).getPropertyValue("--lk-light"));
  const base0 = parse(getComputedStyle(document.body).backgroundColor) || { r: 23, g: 18, b: 8, a: 1 };
  const page = base0.a === 0 ? (document.documentElement.classList.contains("sa-light") ? { r: 232, g: 222, b: 200, a: 1 } : { r: 23, g: 18, b: 8, a: 1 }) : base0;
  const bgOf = (el) => { const stack = []; let cur = el;
    while (cur && cur !== document.documentElement) { const c = parse(getComputedStyle(cur).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; } cur = cur.parentElement; }
    let acc = { ...page }; for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc); return acc; };
  const out = []; let n = 0;
  if (!L) return { n, out: ["нет --lk-light"] };
  for (const card of document.querySelectorAll('[data-lens-card]')) {
    const cr = card.getBoundingClientRect(); if (!cr.width || card.offsetParent === null) continue;
    const cx = cr.left + 0.2 * cr.width, cy = cr.top;
    for (const el of card.querySelectorAll("*")) {
      if (el.children.length || el.closest("[data-lens-card]") !== card || el.closest("[data-lens-btn],button,input,textarea")) continue;
      const t = (el.textContent || "").trim(); if (t.length < 2) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const st = getComputedStyle(el); if (+st.opacity < 0.95) continue;
      const nx = Math.max(r.left, Math.min(cx, r.right)), ny = Math.max(r.top, Math.min(cy, r.bottom));
      const d = Math.sqrt(((nx - cx) / (1.2 * cr.width)) ** 2 + ((ny - cy) / 70) ** 2), k = Math.max(0, 1 - d / 0.6);
      const base = bgOf(el), lit = over({ ...L, a: L.a * k }, base), fg = parse(st.color); if (!fg) continue;
      const size = parseFloat(st.fontSize), bold = +st.fontWeight >= 700, need = size >= 18.66 || (bold && size >= 14) ? 3 : 4.5;
      const r0 = ratio(over(fg, base), base), r1 = ratio(over(fg, lit), lit); n++;
      if (r0 >= need && r1 < need) out.push(`«${t.slice(0, 24)}» ${r0.toFixed(2)}→${r1.toFixed(2)}/${need}`);
    }
  }
  return { n, out };
};
const lightAudit = (page) => page.evaluate(`(${LIGHT_AUDIT.toString()})()`);

const HI_L = "rgb(107, 78, 26)", WARN = "rgba(228, 179, 106, 0.7)";
const vis = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].some((x) => x.offsetParent !== null), sel);
const clickText = (page, sel, t) => page.evaluate(([sel, t]) => { const e = [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null && x.textContent.trim().startsWith(t)).pop(); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } return !!e; }, [sel, t]);
const go = async (page, s, ms = 2400) => { await nav(page, "home", 800); await nav(page, s, ms); };
const REPORT_RPC = (fn) => {
  const day = (n) => new Date(Date.now() + SHIFT_MS - n * 86400e3).toISOString();
  if (fn === "report_people") return { ok: true, scope: "all", restaurant: R0, rows: [
    { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", last_role: "seasonal", lessons: 6, quiz: 1, wrong30: 7, mistakes: 3, due: 2, days14: 5, seen: day(1), learning_at: day(1) },
    { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", last_role: "seasonal", lessons: 12, quiz: 3, wrong30: 1, mistakes: 0, due: 1, days14: 8, seen: day(0), learning_at: day(0) },
    // ещё трое — от пяти строк появляется поиск
    ...[["e-vera", "Вера", "Соколова"], ["e-darya", "Дарья", "Лебедева"], ["e-ilya", "Илья", "Белов"]].map(([id, name, surname], k) => ({ id, name, surname, restaurant: R0, position: "waiter", last_role: "seasonal", lessons: 4 + k, quiz: 1, wrong30: 0, mistakes: 0, due: 0, days14: 3, seen: day(1), learning_at: day(1) })),
  ] };
  return undefined;
};

await run("ME", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv });
  await go(a.page, "profile");
  const card = await st(a.page, '[data-lens-card][data-settings]'), pin = await st(a.page, 'input[data-lens-field][type="password"]'), sv = await st(a.page, await pick(a.page, "button", "Сохранить"));
  const out = await st(a.page, await pick(a.page, "button", "Выйти с этого устройства"));
  ok("ME: аккаунт — настройки карточкой, PIN — стекло, «Сохранить» (PIN не введён) — стекло, «Выйти» — красная капсула",
    lensCard(card) && !!pin && pin.bg === GLASS && isSoft(sv) && !!out && out.rad === "999px" && out.color === RED && !/radial-gradient/.test(out.img), JSON.stringify([card, pin, sv, out]));
  await shot(a.page, "account");
  await a.page.locator(await pick(a.page, "button", "Выйти с этого устройства")).click(); await sleep(400);
  const stay = await st(a.page, await pick(a.page, "button", "Остаться")), ex = await st(a.page, await pick(a.page, "button", "Выйти"));
  ok("ME: «Остаться» — стекло, «Выйти» — прежний красный, капсулой", isSoft(stay) && !!ex && ex.rad === "999px" && ex.bg === "rgb(224, 120, 120)", JSON.stringify([stay, ex]));
  const b = await open({ who: ANNA, srv });
  await go(b.page, "stats");
  const tile = await st(b.page, '[data-lens-edge]'), role = await st(b.page, await pick(b.page, "[data-lens-card]", "Хостес"));
  ok("ME: статистика (есть прогресс) — итоги кромкой, роли — карточками", isEdge(tile) && lensCard(role), JSON.stringify([tile, role]));
  const [e1, e2] = noErr(a, b); ok("ME: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("RATING", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await go(a.page, "leaderboard");
  const lg = await st(a.page, await pick(a.page, ".sa-card[data-lens-card]", "Лига недели")), rec = await st(a.page, await pick(a.page, ".sa-card[data-lens-card]", "Рекорды команды"));
  const ws = await st(a.page, await pick(a.page, "[data-lens-edge]", "Сотрудник недели"));
  ok("RATING: лига и рекорды — карточки, «Сотрудник недели» — кромка со своим градиентом", lensCard(lg) && lensCard(rec) && !!ws && ws.bc === EDGE && /linear-gradient/.test(ws.img), JSON.stringify([lg, rec, ws]));
  await shot(a.page, "rating");
  await go(a.page, "league");
  const c1 = await st(a.page, "[data-lens-card]");
  ok("RATING: лига — карточки линзы", lensCard(c1), JSON.stringify(c1));
  const [e1, e2] = noErr(a); ok("RATING: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("BOOK", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await go(a.page, "guestbook", 2600);
  const hd = await st(a.page, "[data-lens-card]");
  const nx = await a.page.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "›" && x.offsetParent !== null)[0]; if (!b) return null; const s = getComputedStyle(b); return { lens: b.getAttribute("data-lens"), dis: b.disabled, bg: s.backgroundColor }; });
  ok("BOOK: шапка — карточка; «›» листания — линза, пока можно листать", lensCard(hd) && !!nx && (nx.dis ? nx.lens === null : nx.lens === "disc" && nx.bg === GLASS), JSON.stringify([hd, nx]));
  const pg = await a.page.evaluate(() => { const p = document.querySelector(".gb-page-r, .gb-page-l"); return p ? [...p.querySelectorAll("[data-lens],[data-lens-card],[data-lens-btn]")].length : -1; });
  ok("BOOK: страница книги — бумага, без линз", pg === 0, String(pg));
  await shot(a.page, "book");
  const [e1, e2] = noErr(a); ok("BOOK: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("ADMIN", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv });
  await go(a.page, "analytics", 2800);
  const g = await st(a.page, "[data-lens-edge]"), bk = await st(a.page, await pick(a.page, "button", "Скачать копию"));
  ok("ADMIN: аналитика — карточки кромкой со своим градиентом, «Скачать копию» — стекло", !!g && g.bc === EDGE && /linear-gradient/.test(g.img) && isSoft(bk), JSON.stringify([g, bk]));
  await go(a.page, "server", 3200);
  const todo = await st(a.page, "[data-srv-todo]"), db = await st(a.page, "[data-srv-db]"), again = await st(a.page, "[data-srv-again]"), tg = await st(a.page, "[data-srv-tgsetup]");
  ok("ADMIN: сервер — «нужно сделать» жёлтой кромкой, этапы — карточкой, «Проверить ещё раз» — стекло, «Подключить бота» — плашка",
    !!todo && (todo.bc === WARN || /138, 216, 175/.test(todo.bc)) && lensCard(db) && isSoft(again) && (tg === null || isMain(tg)), JSON.stringify([todo, db, again, tg]));
  await shot(a.page, "server");
  const [e1, e2] = noErr(a); ok("ADMIN: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("REPORT", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv, rpcs: REPORT_RPC });
  await go(a.page, "report", 3000);
  ok("REPORT: список сотрудников открылся", await until(() => a.page.locator(".rp .rp-row").count(), 9000) > 0);
  const row = await st(a.page, ".rp .rp-row:not(.att)"), att = await st(a.page, ".rp .rp-row.att"), xl = await st(a.page, ".rp .rp-btn.main"), pdf = await st(a.page, ".rp .rp-btn:not(.main)");
  ok("REPORT: строки — кромка и блик, «Требуют внимания» — своя красная кромка; «Excel» — плашка с кольцом, «PDF» — стекло",
    !!row && row.bc === EDGE && row.sh.includes(HL) && !!att && /192, 98, 75/.test(att.bc) && !!xl && /radial-gradient/.test(xl.img) && xl.ring === RING && !!pdf && pdf.bg === GLASS, JSON.stringify([row, att, xl, pdf]));
  const on = await st(a.page, ".rp .rp-chip.on"), off = await st(a.page, ".rp .rp-chip:not(.on)"), q = await st(a.page, ".rp .rp-search input");
  ok("REPORT: фильтр — выбранный плашкой, остальные стеклом; поиск — стекло", isTab(on) && !!off && off.bg === GLASS && off.color === GOLD_L && !!q && q.bg === GLASS, JSON.stringify([on, off, q]));
  await shot(a.page, "report");
  const [e1, e2] = noErr(a); ok("REPORT: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("EDIT", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv });
  await go(a.page, "contentEditor", 2800);
  const nw = await st(a.page, await pick(a.page, "button", "Новый урок"));
  ok("EDIT: уроки — «Новый урок» плашкой с кольцом", isMain(nw), JSON.stringify(nw));
  await clickText(a.page, "button", "Новый урок"); await sleep(1200);
  const f = await st(a.page, "input[data-lens-field]");
  ok("EDIT: форма урока — поля стеклом", !!f && f.bg === GLASS, JSON.stringify(f));
  await go(a.page, "ckEditor", 2600);
  await clickText(a.page, "button", "＋ Новый коктейль"); await sleep(1000);
  const ci = await st(a.page, 'input[data-lens-field][placeholder="Название коктейля"]'), cc = await st(a.page, await pick(a.page, "button", "Отмена"));
  ok("EDIT: коктейль — поля стеклом, «Отмена» — стекло", !!ci && ci.bg === GLASS && isSoft(cc), JSON.stringify([ci, cc]));
  await go(a.page, "menuTrainer", 2200); await clickText(a.page, ".sa-card", "Редактор меню"); await sleep(1800);
  const add = await st(a.page, await pick(a.page, "button", "+ Добавить блюдо")), all = await st(a.page, '[data-lens-btn="tab"]');
  ok("EDIT: меню — «+ Добавить блюдо» плашкой, выбранный раздел — плашка", isMain(add) && isTab(all), JSON.stringify([add, all]));
  await shot(a.page, "menu-editor");
  const [e1, e2] = noErr(a); ok("EDIT: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv, light: true, rpcs: REPORT_RPC });
  await go(a.page, "server", 3200);
  const againSel = "[data-srv-again]", ag = await st(a.page, againSel);
  ok("PAPER: стекло сервера — тёмным золотом", !!ag && ag.color === HI_L, JSON.stringify(ag));
  const r1 = await pxRatio(a.page, againSel);
  await go(a.page, "report", 3000); await until(() => a.page.locator(".rp .rp-row").count(), 9000);
  const xl = await st(a.page, ".rp .rp-btn.main"), off = await st(a.page, ".rp .rp-chip:not(.on)");
  ok("PAPER: отчёты — светлая плашка «Excel», фильтры тёмным золотом", !!xl && xl.color === HI_L && xl.img.includes("rgba(255, 255, 255, 0.85)") && !!off && off.color === HI_L, JSON.stringify([xl, off]));
  const r2 = await pxRatio(a.page, ".rp .rp-chip:not(.on)"), r3 = await pxRatio(a.page, ".rp .rp-btn.main");
  ok("PAPER: контраст по пикселям — «Проверить ещё раз», фильтр, «Excel» не ниже нормы", [r1, r2, r3].every((r) => !!r && r.r >= r.need), JSON.stringify([r1, r2, r3]));
  await shot(a.page, "paper-report");
  const [e1, e2] = noErr(a); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv, rpcs: REPORT_RPC, seedExtra: { sa_home_look: "now" } });
  await go(a.page, "profile");
  const card = await st(a.page, "[data-settings]"), out = await st(a.page, await pick(a.page, "button", "Выйти с этого устройства"));
  ok("NOW: аккаунт — прежний (без света линзы, «Выйти» — прежнее скругление 14)", !!card && !/radial-gradient/.test(card.img) && !!out && out.rad === "14px", JSON.stringify([card, out]));
  await go(a.page, "report", 3000); await until(() => a.page.locator(".rp .rp-row").count(), 9000);
  const row = await st(a.page, ".rp .rp-row:not(.att)"), xl = await st(a.page, ".rp .rp-btn.main");
  ok("NOW: отчёты — строки и «Excel» прежние", !!row && row.bc !== EDGE && !!xl && /linear-gradient/.test(xl.img) && !xl.ring, JSON.stringify([row, xl]));
  const [e1, e2] = noErr(a); ok("NOW: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv, w: 320, h: 700, rpcs: REPORT_RPC });
  await go(a.page, "server", 3200);
  const f1 = await fits(a.page), r1 = await ringIn(a.page, '[data-lens-btn="main"],[data-lens="back"]');
  await go(a.page, "report", 3000); await until(() => a.page.locator(".rp .rp-row").count(), 9000);
  const f2 = await fits(a.page), r2 = await ringIn(a.page, ".rp .rp-btn.main");
  ok("NARROW: 320 px — сервер и отчёты без сдвига вбок, кольца в экране", f1.sw <= f1.W && f2.sw <= f2.W && !r1.length && !r2.length, JSON.stringify([f1, r1, f2, r2]));
  await shot(a.page, "narrow-report");
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
