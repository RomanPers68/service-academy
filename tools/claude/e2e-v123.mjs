// e2e v123 (Доп. 436): тренировка по винной карте. Владелец (31.10): «Вин будет достаточно и, к большому сожалению, их
// учить очень сложно, особенно для новичка. Может, сделаем как в меню, с тренировками, викторинами и т. д.?». Сервер —
// tools/claude/demo-app/fake-server.js, как e2e-v120 и v122. Разделы:
//   HUB     — «Учить вина» над картой (новые не выучены — подсвечено), тренировка: новые вина, путь новичка, колода,
//             викторина; руководителю — «Проверить подряд»;  STAFF — официанту — сколько вин ждут проверки;
//   DECK    — колода: порядок карты, только проверенные, переворот, свайп, фильтры, «Наоборот» (описание без названия и
//             без фото этикетки);
//   KNOW    — «С чего начать: вина бокалом»: «Знаю?», «Повторить», интервалы, «пять в день», «Дальше: вся карта»;
//   NEW     — «Новые вина»: «Выучил новые вина ✓», на телефоне — какие выучены;
//   QUIZ    — викторина: только проверенные вина, верный/неверный, пояснение, итог, ошибки — к повтору, «Повторить ошибки»;
//   REVIEW  — «Проверка подряд»: «Верно», «Исправить» (форма и дальше), итог; FROMHUB — из тренировки, «Пропустить»;
//   MENU    — «Винная карта» в тренажёре меню; ADDED — addedAt у нового вина и импорта;
//   GAPS    — владелец: «Кнопки слиплись»: отступы у кнопок редактора (и в импорте) не съедаются, кольца не касаются;
//   LENS, PAPER — линза и «Для чтения», контраст; NOW — вид «как сейчас»; NARROW — 320 px.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v123.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v123";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v123";
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
function srvOf(menu = MENU) {
  const pings = [];
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu,
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s0-p", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"] }, quizzes: { "e-anna": ["s0-q"] },
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

async function open({ who = MARIA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, mobile = true, path = "/", seedExtra = {}, fold = false, hints = true, menu = MENU } = {}) {
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
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: menu }), sa_boot_missing: String(Date.now() + SHIFT_MS),
    ...(fold ? {} : { sa_hub_open: "all" }), ...(process.env.E2E_LOOK ? { sa_home_look: process.env.E2E_LOOK } : {}), ...seedExtra };
  if (hints) { for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1"; }
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  const page = await ctx.newPage();
  if (SHIFT_MS) await page.clock.install({ time: Date.now() + SHIFT_MS });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + path, { waitUntil: "load", timeout: 30000 });
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

const shown = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].some((x) => { const r = x.getBoundingClientRect(), s = getComputedStyle(x);
  return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; }), sel);
const clickText = (page, sel, t) => page.evaluate(([sel, t]) => { const e = [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null && x.textContent.trim().startsWith(t)).pop(); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } return !!e; }, [sel, t]);
const go = async (page, s, ms = 2400) => { await nav(page, "home", 800); await nav(page, s, ms); };
const hideToasts = (page) => page.addStyleTag({ content: "[data-ms-toast]{display:none!important}" });
const pxAll = async (page, sels) => { const out = []; for (const s of sels) { const r = await pxRatio(page, s); if (r && r.r < r.need) out.push(r.t + " " + r.r + "/" + r.need); else if (!r) out.push("нет " + s); } return out; };
const { normWine } = await import(SRC + "/lib/wine.js");

// карта: пять вин, одно (розе) — с полями от AI, ещё не проверено; одно — в архиве
const dishId = (n) => (MENU.find((d) => d && d.name && d.name.startsWith(n)) || {}).id;
const WINES = [
  normWine({ name: "Просекко DOC Extra Dry", producer: "Bottega", country: "Италия", region: "Венето", grapes: ["глера"], color: "sparkling", sweet: "экстра сухое", byGlass: true, priceGlass: 650, priceBottle: 3600, temp: "6–8 °C", glass: "флюте", notes: ["груша", "белые цветы"], short: "Лёгкие пузырьки и груша: начать вечер и к закускам.", pair: [dishId("Креветка темпура")] }, { id: "w-pro" }),
  normWine({ name: "Шабли", producer: "Domaine Laroche", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", vintage: "2022", byGlass: true, priceGlass: 950, priceBottle: 5200, temp: "8–10 °C", glass: "бургундия", notes: ["зелёное яблоко", "мел"], short: "Свежее и минеральное: к морепродуктам.", story: "Шардоне без дуба с известняковых почв.", pair: [dishId("Закуска из морепродуктов")] }, { id: "w-cha" }),
  normWine({ name: "Розе Côtes de Provence", country: "Франция", region: "Прованс", grapes: ["гренаш"], color: "rose", sweet: "сухое", vintage: "2023", priceBottle: 5900, notes: ["клубника"], short: "Бледное и сухое розовое.", ai: ["grapes", "notes", "short"] }, { id: "w-ros" }),
  normWine({ name: "Пино Нуар", producer: "Louis Jadot", country: "Франция", region: "Бургундия", grapes: ["пино нуар"], color: "red", sweet: "сухое", vintage: "2020", byGlass: true, priceGlass: 1100, priceBottle: 6100 }, { id: "w-pin" }),
  normWine({ name: "Кьянти Классико", country: "Италия", region: "Тоскана", grapes: ["санджовезе"], color: "red", sweet: "сухое", priceBottle: 7400 }, { id: "w-chi" }),
  normWine({ name: "Старое Мерло", color: "red", archived: true }, { id: "w-old" }),
];
const MENU_W = [...JSON.parse(JSON.stringify(MENU)), ...WINES];
const wines = (srv) => (srv.S.menu || []).filter((d) => d && d.kind === "wine");
// AI винной карты — своими ответами: что пришло (calls) и что ответить (by mode)
const aiRoute = async (ctx, calls, answer) => ctx.route("**/api/wine-import", async (route) => {
  let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
  calls.push(b);
  const r = answer(b);
  return route.fulfill({ status: r.status || 200, contentType: "application/json", body: JSON.stringify(r.body || r) });
});
const GUESS = (name) => ({ name, producer: "Хозяйство " + name.split(" ")[0], country: "Италия", region: "Пьемонт", grapes: ["неббиоло"], color: "red", sweet: "сухое", temp: "16–18 °C", glass: "бордо", notes: ["роза", "смола"], short: "Строгое и ароматное красное.", story: "Неббиоло из Пьемонта." });
const ANSWER = (b) => b.mode === "fill" ? { wines: [GUESS(b.name)] } : b.mode === "names" ? { wines: b.names.map(GUESS) }
  : { wines: [{ ...GUESS("Гави ди Гави"), color: "white", grapes: ["кортезе"], priceGlass: 820, priceBottle: 4600, byGlass: true }, { ...GUESS("Бароло"), priceBottle: 12800 }, { ...GUESS(b.mode === "pdf" ? "Мальбек из PDF" : "Риоха Резерва"), priceBottle: 5900 }] };
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
mkdirSync(OUT + "/in", { recursive: true });
const { writeFileSync } = await import("node:fs");
writeFileSync(OUT + "/in/page.jpg", JPG); writeFileSync(OUT + "/in/carta.pdf", PDF);
const toList = async (page) => { await go(page, "reference", 1800); return clickText(page, ".sa-card, [data-ref-card]", "Наша винная карта"); };


// ── v122: фото бутылок ──
const PHOTO_HOST = "https://photos.e2e";
const MENU_P = MENU_W.map((d) => (d && d.id === "w-pin" ? { ...d, img: PHOTO_HOST + "/seed/pin.jpg" } : d));
// «бутылка» для снимков: 600 × 800, тёмный фон, силуэт и светлая этикетка (JPEG, как с телефона)
const BOTTLE = await sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 52, g: 36, b: 20 } } })
  .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><path d="M270 60h60v180c0 40 80 60 80 140v360a20 20 0 0 1-20 20H210a20 20 0 0 1-20-20V380c0-80 80-100 80-140z" fill="#2c3a22"/><rect x="215" y="470" width="170" height="200" fill="#efe4c8"/><text x="300" y="560" font-size="34" text-anchor="middle" fill="#3a2a14">GAVI</text></svg>'), top: 0, left: 0 }])
  .jpeg({ quality: 82 }).toBuffer();
const shotFile = (n = 1) => ({ name: "bottle-" + n + ".jpg", mimeType: "image/jpeg", buffer: BOTTLE });
// хранилище фото: photo-upload отвечает ссылкой, по ссылке отдаётся снимок; fail — функция не развёрнута (404)
const photoRoutes = async (ctx, log, { fail = false, delay = 0 } = {}) => {
  await ctx.route("**/functions/v1/photo-upload", async (route) => {
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    log.push({ id: b.dishId, restaurant: b.restaurant, head: String(b.image || "").slice(0, 23), len: String(b.image || "").length, token: !!b.token });
    if (delay) await sleep(delay);
    if (fail) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "NOT_FOUND", message: "Requested function was not found" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, url: PHOTO_HOST + "/dva-morya/" + b.dishId + "-" + log.length + ".jpg" }) });
  });
  await ctx.route(PHOTO_HOST + "/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: BOTTLE }));
};
// этикетки: по очереди из списка (как прочитала бы модель)
const LABEL = { gavi: { name: "Гави ди Гави", producer: "La Scolca", country: "Италия", region: "Пьемонт", vintage: "2022", color: "white", grapes: ["кортезе"], notes: ["груша", "миндаль"], temp: "8–10 °C", glass: "универсальный" },
  chablis: { name: "Шабли", producer: "Domaine Laroche", vintage: "2022", color: "white", abv: 12.5, volume: "0,75 л" }, pinot: { name: "Пино Нуар", producer: "Louis Jadot", vintage: "2020", color: "red" } };
const labelAi = (queue) => (b) => (b.mode === "label" ? (queue.length ? { wines: [queue.shift()] } : { status: 422, body: { error: "Этикетку не прочитать: сними бутылку ближе, при свете, этикеткой к камере" } }) : ANSWER(b));
const toEditor = async (page) => { await toList(page); await sleep(1300); await page.locator("[data-wine-edit]").click(); await sleep(1300); };
const imgOk = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((i) => ({ src: i.getAttribute("src").slice(0, 40), ok: i.complete && i.naturalWidth > 0 })), sel);
const pal = (light) => (light ? { GLASS: "rgba(139, 106, 48, 0.09)", EDGE: "rgba(139, 106, 48, 0.3)" } : { GLASS, EDGE });

// ── v123: тренировка по винной карте ──
const DAY = 864e5, PNOW = Date.now() + SHIFT_MS;
// карта тренировки: «Просекко» и «Шабли» добавлены два дня назад (новые), «Пино» и «Кьянти» — давно (addedAt нет, как у вин
// до v123); у «Пино» фото; «Розе» и «Гави» — с полями от AI (не проверены, в тренировку не идут); «Старое Мерло» — в архиве
const GAVI = normWine({ name: "Гави ди Гави", country: "Италия", region: "Пьемонт", grapes: ["кортезе"], color: "white", sweet: "сухое", priceBottle: 4600, notes: ["груша", "миндаль"], ai: ["region", "grapes", "notes"] }, { id: "w-gav" });
const T_WINES = [...WINES.map((w) => (w.id === "w-pro" || w.id === "w-cha" ? { ...w, addedAt: PNOW - 2 * DAY } : w.id === "w-pin" ? { ...w, img: PHOTO_HOST + "/seed/pin.jpg" } : w)), GAVI];
const MENU_T = [...JSON.parse(JSON.stringify(MENU)), ...T_WINES];
const TITLE = Object.fromEntries(T_WINES.map((w) => [w.id, w.name + (w.vintage && !w.name.includes(w.vintage) ? " " + w.vintage : "")]));
const SRK = "sa_wine_sr_" + R0, LRK = "sa_wine_learned_" + R0;
const lsGet = (page, k) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }, k);
const toHub = async (page) => { await toList(page); await sleep(1300); await page.locator("[data-wine-train-open]").click(); await sleep(700); };
const hubOpen = async (page, key) => { await page.locator(`[data-wine-train="${key}"]`).click(); await sleep(800); };
const deckState = (page) => page.evaluate(() => {
  const at = (sel, a) => { const e = document.querySelector(sel); return e ? e.getAttribute(a) : null; };
  const front = document.querySelector("[data-wine-deck-card] .sa-ck-front"), back = document.querySelector("[data-wine-deck-card] .sa-ck-back");
  return { mode: at("[data-wine-deck]", "data-wine-deck"), only: at("[data-wine-deck]", "data-wine-deck-only"), card: at("[data-wine-deck-card]", "data-wine-deck-card"),
    count: (document.querySelector("[data-wine-deck-count]") || {}).textContent || "", flip: at("[data-wine-flip]", "data-wine-flip"), empty: at("[data-wine-deck-empty]", "data-wine-deck-empty"),
    known: at("[data-wine-deck-known]", "data-wine-deck-known"), front: front ? front.innerText.replace(/\s+/g, " ").trim() : "", back: back ? back.innerText.replace(/\s+/g, " ").trim() : "",
    seg: [...document.querySelectorAll("[data-wine-deck-mode]")].map((e) => e.textContent.trim()) };
});
const swipe = async (o, dir = 1) => {
  const cdp = await o.ctx.newCDPSession(o.page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const r = await o.page.evaluate(() => { const b = document.querySelector("[data-wine-deck-card]").getBoundingClientRect(); return { y: b.top + b.height / 2, l: b.left, w: b.width }; });
  const x0 = dir > 0 ? r.l + r.w * 0.85 : r.l + r.w * 0.15, x1 = dir > 0 ? r.l + r.w * 0.1 : r.l + r.w * 0.9;
  await touch("touchStart", x0, r.y);
  for (let i = 1; i <= 12; i++) { await touch("touchMove", x0 + (x1 - x0) * i / 12, r.y + 2); await sleep(16); }
  await touch("touchEnd");
  await sleep(900);
};
const pageNow = (page) => page.evaluate(() => Date.now());

await run("HUB", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toList(o.page); await sleep(1300);
  const entry = await o.page.evaluate(() => { const e = document.querySelector("[data-wine-train-open]"), s = document.querySelector('input[type="search"]');
    return e ? { hi: e.getAttribute("data-wine-train-open"), t: e.innerText.replace(/\s+/g, " ").trim(), above: s ? e.getBoundingClientRect().top < s.getBoundingClientRect().top : null } : null; });
  ok("HUB: над картой — «Учить вина»; новые вина ещё не выучены — подсвечено «новое»", !!entry && entry.hi === "new" && /^Учить вина\s*новое/.test(entry.t) && /Новые вина: 2/.test(entry.t) && entry.above === true, JSON.stringify(entry));
  await shot(o.page, "hub-entry");
  await o.page.locator("[data-wine-train-open]").click(); await sleep(800);
  const hub = await o.page.evaluate(() => ({ n: (document.querySelector("[data-wine-hub]") || { getAttribute: () => null }).getAttribute("data-wine-hub"),
    rows: [...document.querySelectorAll("[data-wine-train]")].map((e) => e.getAttribute("data-wine-train") + ":" + e.innerText.replace(/\s+/g, " ").trim()),
    check: (document.querySelector("[data-wine-hub-check]") || { getAttribute: () => null }).getAttribute("data-wine-hub-check"), btn: !!document.querySelector("[data-wine-review-open]"),
    sum: (document.querySelector("[data-wine-hub-sum]") || {}).textContent || "", edit: !!document.querySelector("[data-wine-edit]"), title: document.querySelector("[data-wine-train-hub]") ? document.querySelector("[data-wine-train-hub]").innerText.slice(0, 40) : "" }));
  ok("HUB: тренировка — «Новые вина» (2, «новое»), «С чего начать: вина бокалом» (0 из 3), колода, викторина; в тренировке 4 проверенных вина",
    hub.n === "4" && hub.rows.map((r) => r.split(":")[0]).slice(0, 4).join(",") === "new,glass,deck,quiz" && /^new:Новые вина\s*новое/.test(hub.rows[0]) && /2 вина за последний месяц/.test(hub.rows[0])
      && /Выучено 0 из 3/.test(hub.rows[1]) && /^В тренировке 4 вина$/.test(hub.sum.trim()) && !hub.edit, JSON.stringify(hub));
  ok("HUB: руководителю — «Не проверено: 2 вина…» и «Проверить подряд»", hub.check === "2" && hub.btn, JSON.stringify({ check: hub.check, btn: hub.btn }));
  await shot(o.page, "hub");
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(600);
  ok("HUB: «назад» из тренировки — к карте", (await o.page.locator("[data-wine-list]").count()) === 1);
  const [e1, e2] = noErr(o); ok("HUB: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("STAFF", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toHub(o.page);
  const s = await o.page.evaluate(() => ({ wait: (document.querySelector("[data-wine-hub-wait]") || { getAttribute: () => null }).getAttribute("data-wine-hub-wait"), t: (document.querySelector("[data-wine-hub-wait]") || {}).textContent || "",
    btn: !!document.querySelector("[data-wine-review-open]"), check: !!document.querySelector("[data-wine-hub-check]"), rows: document.querySelectorAll("[data-wine-train]").length }));
  ok("STAFF: официанту — сколько вин ждут проверки руководителем, без «Проверить подряд»", s.wait === "2" && /Ещё 2 вина ждут проверки руководителем/.test(s.t) && !s.btn && !s.check && s.rows >= 4, JSON.stringify(s));   // v124: пунктов тренировки больше
  const [e1, e2] = noErr(o); ok("STAFF: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("DECK", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toHub(o.page); await hubOpen(o.page, "deck");
  const d0 = await deckState(o.page);
  ok("DECK: «Колода вин» — листать, 1 из 4, первое — «Просекко» (порядок карты), название на лицевой", d0.mode === "deck" && d0.only === "all" && d0.count === "1/4" && d0.card === "w-pro" && d0.front.includes("Просекко DOC Extra Dry") && d0.flip === "front", JSON.stringify(d0));
  await shot(o.page, "deck-front");
  await o.page.locator("[data-wine-deck-card]").click(); await sleep(1100);
  const d1 = await deckState(o.page);
  const hid1 = await o.page.evaluate(() => getComputedStyle(document.querySelector("[data-wine-deck-card] .sa-ck-front")).display === "none");
  ok("DECK: тап — переворот: фраза гостю, ноты, подача; лицевая не просвечивает", d1.flip === "back" && d1.back.includes("Лёгкие пузырьки и груша") && d1.back.includes("груша") && /6–8 °C/.test(d1.back) && hid1, JSON.stringify({ flip: d1.flip, hid1, back: d1.back.slice(0, 160) }));
  await shot(o.page, "deck-back");
  const ids = [];
  for (let i = 0; i < 5; i++) { ids.push((await deckState(o.page)).card); await o.page.locator('[data-wine-go="1"]').click(); await sleep(900); }
  ok("DECK: в колоде 4 проверенных вина в порядке карты, по кругу; «не проверено» и архив — мимо", ids.join(",") === "w-pro,w-cha,w-chi,w-pin,w-pro", ids.join(","));
  await swipe(o, 1);
  const sw = await deckState(o.page);
  await swipe(o, -1);
  const sw2 = await deckState(o.page);
  ok("DECK: свайп влево — следующее, вправо — назад", sw.card === "w-chi" && sw.count === "3/4" && sw2.card === "w-cha", JSON.stringify([sw.card, sw.count, sw2.card]));
  await o.page.locator("[data-wine-deck-find]").click(); await sleep(400);
  const chips = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-deck-chip]")].map((e) => e.getAttribute("data-wine-deck-chip") + "=" + e.textContent.trim()));
  ok("DECK: фильтры — все, бокалом, новые, по цвету (со счётом)", chips.join("|") === "all=Все · 4|glass=Бокалом · 3|new=Новые · 2|sparkling=Игристые · 1|white=Белые · 1|red=Красные · 2", chips.join("|"));
  await o.page.locator('[data-wine-deck-chip="red"]').click(); await sleep(500);
  const r0 = await deckState(o.page);
  await o.page.locator('[data-wine-go="1"]').click(); await sleep(900);
  const pin = await deckState(o.page), pinPhoto = await o.page.locator("[data-wine-deck-card] [data-wine-deck-photo]").count();
  ok("DECK: «Красные» — 2 вина; у «Пино Нуар» на лицевой фото бутылки", r0.count === "1/2" && r0.card === "w-chi" && pin.card === "w-pin" && pinPhoto === 1, JSON.stringify([r0.count, r0.card, pin.card, pinPhoto]));
  await o.page.locator("[data-wine-deck-reverse]").click(); await sleep(600);
  const rv = await deckState(o.page);
  const rvPhoto = await o.page.locator("[data-wine-deck-card] [data-wine-deck-photo]").count(), rvArt = await o.page.locator('[data-wine-deck-card] .sa-ck-front [data-wine-art="red"]').count();
  const clues = await txt(o.page.locator("[data-wine-deck-card] [data-wine-clues]"));
  ok("DECK: «Наоборот» — описание без названия (как гость просит), фото нет (на этикетке ответ), вместо него бутылка цвета вина",
    /Что за вино\?/.test(rv.front) && !/Кьянти|Пино/.test(rv.front) && /Италия, Тоскана|Франция, Бургундия/.test(clues) && rvPhoto === 0 && rvArt === 1 && /название по тапу/.test(rv.front), JSON.stringify({ front: rv.front.slice(0, 140), rvPhoto, rvArt }));
  await shot(o.page, "deck-reverse");
  await o.page.locator("[data-wine-deck-card]").tap(); await sleep(1100);   // после свайпа — касанием, как пальцем
  const rb = await deckState(o.page);
  const frontHidden = await o.page.evaluate(() => getComputedStyle(document.querySelector("[data-wine-deck-card] .sa-ck-front")).display === "none");
  ok("DECK: в «Наоборот» переворот открывает название; лицевая после переворота спрятана (не просвечивает)", rb.flip === "back" && /Кьянти Классико|Пино Нуар 2020/.test(rb.back) && frontHidden, JSON.stringify({ flip: rb.flip, frontHidden, back: rb.back.slice(0, 80) }));
  const [e1, e2] = noErr(o); ok("DECK: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("KNOW", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toHub(o.page); await hubOpen(o.page, "glass");
  const k0 = await deckState(o.page);
  ok("KNOW: «С чего начать» — «Знаю?» по винам бокалом: к повтору 3, выучено 0 из 3", k0.mode === "quiz" && k0.only === "glass" && k0.count === "1/3" && k0.known === "0/3" && k0.seg[1] === "Знаю? · 3" && k0.card === "w-pro", JSON.stringify(k0));
  await shot(o.page, "know");
  await o.page.locator('[data-wine-mark="again"]').click(); await sleep(500);
  const k1 = await deckState(o.page), sr1 = await lsGet(o.page, SRK);
  ok("KNOW: «Повторить» — дальше по кругу, вино осталось к повтору", k1.card === "w-cha" && k1.seg[1] === "Знаю? · 3" && sr1 && sr1["w-pro"] && sr1["w-pro"].stage === 0, JSON.stringify({ card: k1.card, seg: k1.seg, sr1 }));
  for (let i = 0; i < 3; i++) { await o.page.locator('[data-wine-mark="ok"]').click(); await sleep(450); }
  const k2 = await deckState(o.page), sr2 = await lsGet(o.page, SRK), now = await pageNow(o.page);
  const d5 = await lsGet(o.page, "sa_daily5_Анна_Смирнова");
  const day1 = (id) => sr2 && sr2[id] && sr2[id].stage === 1 && Math.abs(sr2[id].due - now - DAY) < 120e3;
  ok("KNOW: «Знал» у всех трёх — «Всё повторено», вернутся через день; прогресс — на телефоне, по ресторану", k2.empty === "quiz" && /Всё повторено/.test(await txt(o.page.locator("[data-wine-deck-empty]"))) && ["w-pro", "w-cha", "w-pin"].every(day1), JSON.stringify({ empty: k2.empty, sr2 }));
  ok("KNOW: каждая отметка — в счёт «пяти в день»", !!d5 && d5.n === 4, JSON.stringify(d5));
  await shot(o.page, "know-done");
  await o.page.locator("[data-wine-deck-all]").click(); await sleep(600);
  const k3 = await deckState(o.page);
  ok("KNOW: «Дальше: вся карта» — «Знаю?» по всем: осталось «Кьянти»", k3.only === "all" && k3.mode === "quiz" && k3.card === "w-chi" && k3.count === "1/1" && k3.known === "3/4", JSON.stringify(k3));
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(700);
  const g = await txt(o.page.locator('[data-wine-train="glass"]')), sum = await txt(o.page.locator("[data-wine-hub-sum]"));
  ok("KNOW: в тренировке — «Бокалом выучены все 3», «выучено 3»", /Бокалом выучены все 3/.test(g) && /выучено 3/.test(sum), JSON.stringify({ g, sum }));
  const [e1, e2] = noErr(o); ok("KNOW: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("NEW", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toHub(o.page); await hubOpen(o.page, "new");
  const n0 = await deckState(o.page);
  ok("NEW: «Новые вина» — «Знаю?» по двум новым", n0.mode === "quiz" && n0.only === "new" && n0.count === "1/2" && ["w-pro", "w-cha"].includes(n0.card), JSON.stringify(n0));
  for (let i = 0; i < 2; i++) { await o.page.locator('[data-wine-mark="ok"]').click(); await sleep(450); }
  const btn = await txt(o.page.locator("[data-wine-learned]"));
  ok("NEW: оба «Знал» — «Выучил новые вина ✓»", btn === "Выучил новые вина ✓", btn);
  await shot(o.page, "new-done");
  await o.page.locator("[data-wine-learned]").click(); await sleep(800);
  const row = await o.page.evaluate(() => { const e = document.querySelector('[data-wine-train="new"]'); return e ? { t: e.innerText.replace(/\s+/g, " ").trim(), lens: e.getAttribute("data-lens-card") } : null; });
  const learned = await lsGet(o.page, LRK);
  ok("NEW: снова в тренировке — «Выучено ✓ · 2 вина», без «новое»; на телефоне — какие вина выучены", !!row && /Выучено ✓ · 2 вина/.test(row.t) && !/новое/.test(row.t) && row.lens === "ok" && JSON.stringify((learned || []).slice().sort()) === '["w-cha","w-pro"]', JSON.stringify({ row, learned }));
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(700);
  const entry = await o.page.evaluate(() => { const e = document.querySelector("[data-wine-train-open]"); return e ? { hi: e.getAttribute("data-wine-train-open"), t: e.innerText.replace(/\s+/g, " ").trim() } : null; });
  ok("NEW: в карте «Учить вина» без подсветки; путь новичка — «бокалом выучено 2 из 3»", !!entry && entry.hi === "" && !/новое/.test(entry.t) && /бокалом выучено 2 из 3/.test(entry.t), JSON.stringify(entry));
  const [e1, e2] = noErr(o); ok("NEW: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("QUIZ", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toHub(o.page); await hubOpen(o.page, "quiz");
  const qs = [];
  for (let i = 0; i < 12; i++) {
    const st0 = await o.page.evaluate(() => { const e = document.querySelector("[data-wine-quiz]"); return e ? { step: e.getAttribute("data-wine-quiz"), kind: e.getAttribute("data-wine-quiz-kind"), text: e.innerText.replace(/\s+/g, " ").trim(), opts: document.querySelectorAll("[data-wine-opt]").length } : null; });
    if (!st0 || st0.step === "done") break;
    if (i === 0) await shot(o.page, "quiz-q");
    await o.page.locator('[data-wine-opt="0"]').click(); await sleep(250);
    const a = await o.page.evaluate(() => ({ ok: [...document.querySelectorAll('[data-lens-opt="ok"]')].length, bad: [...document.querySelectorAll('[data-lens-opt="bad"]')].length,
      first: (document.querySelector('[data-wine-opt="0"]') || { getAttribute: () => "" }).getAttribute("data-lens-opt"), why: !!document.querySelector("[data-wine-why]"), next: (document.querySelector("[data-wine-quiz-next]") || {}).textContent || "" }));
    qs.push({ ...st0, ...a });
    if (i === 0) await shot(o.page, "quiz-answer");
    await o.page.locator("[data-wine-quiz-next]").click(); await sleep(350);
  }
  const right = qs.filter((q) => q.first === "ok").length;
  const clean = qs.every((q) => q.ok === 1 && q.bad === (q.first === "ok" ? 0 : 1) && q.why && q.opts >= 2 && !/Розе|Гави|Старое Мерло/.test(q.text));
  ok("QUIZ: вопросы по своей карте (только проверенные вина), после ответа — верный, неверный и пояснение", qs.length >= 5 && qs.length <= 8 && clean && /Итог/.test(qs[qs.length - 1].next), JSON.stringify(qs.map((q) => [q.kind, q.ok, q.bad, q.first, q.opts, q.text.slice(0, 50)])));
  const done = await o.page.evaluate(() => { const e = document.querySelector('[data-wine-quiz="done"]'); return e ? { score: e.getAttribute("data-wine-quiz-score"), wrong: [...document.querySelectorAll("[data-wine-quiz-wrong] [data-lens-tag]")].map((x) => x.textContent.trim()) } : null; });
  ok("QUIZ: итог — «N из M» по ответам", !!done && done.score === right + "/" + qs.length, JSON.stringify({ done, right, n: qs.length }));
  await shot(o.page, "quiz-done");
  const wrongIds = (done ? done.wrong : []).map((t) => Object.keys(TITLE).find((id) => TITLE[id] === t));
  const sr = await lsGet(o.page, SRK), now = await pageNow(o.page);
  ok("QUIZ: вина с ошибками — к повтору в «Знаю?» (на телефоне)", wrongIds.every((id) => id && sr && sr[id] && sr[id].stage === 0 && sr[id].due <= now) && (right === qs.length || wrongIds.length > 0), JSON.stringify({ wrongIds, sr }));
  if (wrongIds.length) {
    await o.page.locator("[data-wine-quiz-repeat]").click(); await sleep(800);
    const r = await deckState(o.page), seen = [];
    for (let i = 0; i < wrongIds.length; i++) { seen.push((await deckState(o.page)).card); await o.page.locator('[data-wine-mark="ok"]').click(); await sleep(450); }
    ok("QUIZ: «Повторить ошибки» — «Знаю?» ровно по этим винам", r.mode === "quiz" && r.only === "focus" && r.count === "1/" + wrongIds.length && seen.slice().sort().join() === wrongIds.slice().sort().join(), JSON.stringify({ r, seen, wrongIds }));
    await o.page.locator('[data-lens="back"]').first().click(); await sleep(700);
    await hubOpen(o.page, "quiz");
  }
  const again = await o.page.evaluate(() => (document.querySelector("[data-wine-quiz]") || { getAttribute: () => null }).getAttribute("data-wine-quiz"));
  ok("QUIZ: заново — с первого вопроса", again === "0", String(again));
  const [e1, e2] = noErr(o); ok("QUIZ: без ошибок", e1, e2);
  await o.ctx.close();
});

const review = (page) => page.evaluate(() => { const s = document.querySelector("[data-wine-review-screen]"), c = document.querySelector("[data-wine-review]"), d = document.querySelector("[data-wine-review-done]");
  return { at: s ? s.getAttribute("data-wine-review-screen") : null, card: c ? c.getAttribute("data-wine-review") : null, done: d ? d.getAttribute("data-wine-review-done") : null, doneT: d ? d.innerText.replace(/\s+/g, " ").trim() : "",
    rows: [...document.querySelectorAll("[data-wine-rrow]")].map((r) => r.getAttribute("data-wine-rrow") + (r.getAttribute("data-wine-rrow-ai") ? "*" : "")), pos: (document.querySelector("[data-wine-review-pos]") || {}).textContent || "",
    ai: (document.querySelector("[data-wine-review-ai]") || {}).textContent || "" }; });
await run("REVIEW", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toEditor(o.page);
  const start = await txt(o.page.locator("[data-wine-review-start]"));
  ok("REVIEW: в редакторе — «Проверка подряд · 2»", start === "Проверка подряд · 2", start);
  await o.page.locator("[data-wine-review-start]").click(); await sleep(600);
  const r0 = await review(o.page);
  ok("REVIEW: по одному вину на экран, в порядке карты (белое «Гави», потом «Розе»); что дописал AI, подсвечено",
    r0.at === "0/2" && r0.card === "w-gav" && r0.pos === "1 из 2" && r0.rows.join(",") === "place*,grapes*,style,serve,notes*" && /AI дописал: регион, сорт, ноты/.test(r0.ai), JSON.stringify(r0));
  await shot(o.page, "review");
  const calls0 = srv.calls.filter((c) => c.fn === "menu_set").length;
  await o.page.locator("[data-wine-review-ok]").click(); await sleep(1400);
  const gav = wines(srv).find((x) => x.id === "w-gav"), r1 = await review(o.page);
  ok("REVIEW: «Верно» — сохранено у всех (кто проверил), дальше «Розе»", srv.calls.filter((c) => c.fn === "menu_set").length === calls0 + 1 && gav.ai.length === 0 && gav.checkedBy === "Мария Ким" && r1.card === "w-ros" && r1.pos === "2 из 2", JSON.stringify({ ai: gav.ai, by: gav.checkedBy, r1 }));
  await o.page.locator("[data-wine-review-fix]").click(); await sleep(600);
  const form = await o.page.evaluate(() => (document.querySelector("[data-wine-form]") || { getAttribute: () => null }).getAttribute("data-wine-form"));
  await o.page.locator('[data-wine-field="short"]').fill("Бледное, сухое, с клубникой: к салатам и рыбе."); await sleep(200);
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  const ros = wines(srv).find((x) => x.id === "w-ros"), r2 = await review(o.page);
  ok("REVIEW: «Исправить» — форма этого вина; сохранил — поле проверено руками, проверка дальше: итог", form === "w-ros" && ros.short === "Бледное, сухое, с клубникой: к салатам и рыбе." && !ros.ai.includes("short") && r2.done === "1/1/0" && /Проверено: 1 · исправлено: 1 · пропущено: 0\./.test(r2.doneT), JSON.stringify({ form, ai: ros.ai, r2 }));
  await shot(o.page, "review-done");
  await o.page.locator("[data-wine-review-end]").click(); await sleep(500);
  const back = await o.page.evaluate(() => ({ list: !!document.querySelector("[data-wine-editor]"), start: (document.querySelector("[data-wine-review-start]") || {}).textContent || "" }));
  ok("REVIEW: «К списку» — редактор; «Розе» осталось не проверено (AI: сорт, ноты)", back.list && back.start === "Проверка подряд · 1", JSON.stringify(back));
  const [e1, e2] = noErr(o); ok("REVIEW: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("FROMHUB", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toHub(o.page);
  await o.page.locator("[data-wine-review-open]").click(); await sleep(1500);
  const r0 = await review(o.page);
  ok("FROMHUB: «Проверить подряд» из тренировки — сразу «Проверка подряд» в редакторе", r0.at === "0/2" && r0.card === "w-gav", JSON.stringify(r0));
  const calls0 = srv.calls.filter((c) => c.fn === "menu_set").length;
  await o.page.locator("[data-wine-review-skip]").click(); await sleep(400);
  await o.page.locator("[data-wine-review-skip]").click(); await sleep(400);
  const r1 = await review(o.page);
  ok("FROMHUB: «Пропустить» — ничего не сохраняется; в итоге сказано, что пропущенные остались в «Не проверено»",
    srv.calls.filter((c) => c.fn === "menu_set").length === calls0 && r1.done === "0/0/2" && /пропущено: 2\. Пропущенные остались в «Не проверено»\./.test(r1.doneT), JSON.stringify(r1));
  const [e1, e2] = noErr(o); ok("FROMHUB: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("MENU", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await go(o.page, "menuTrainer", 2600);
  const card = await o.page.evaluate(() => { const e = document.querySelector("[data-menu-wines]"); return e ? { n: e.getAttribute("data-menu-wines"), t: e.innerText.replace(/\s+/g, " ").trim() } : null; });
  ok("MENU: в тренажёре меню — «Винная карта»: учить вина своего ресторана (4 проверенных)", !!card && card.n === "4" && /^Винная карта Учить вина: колода, викторина, путь новичка · 4 вина/.test(card.t), JSON.stringify(card));
  await shot(o.page, "menu-card");
  await o.page.locator("[data-menu-wines]").click(); await sleep(1800);
  const hub = await o.page.locator("[data-wine-train-hub]").count();
  ok("MENU: касание — сразу тренировка винной карты", hub === 1);
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(1500);
  ok("MENU: «назад» — обратно в тренажёр меню", (await o.page.locator("[data-menu-wines]").count()) === 1 && (await o.page.locator("[data-menu-mode]").count()) > 0);
  const [e1, e2] = noErr(o); ok("MENU: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("ADDED", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator("[data-wine-new]").click(); await sleep(400);
  await o.page.locator('[data-wine-field="name"]').fill("Совиньон Блан Мальборо");
  await o.page.locator('[data-wine-color="white"]').click();
  await o.page.locator('[data-wine-field="grapes"]').fill("совиньон блан");
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  const now = await pageNow(o.page), sb = wines(srv).find((x) => x.name === "Совиньон Блан Мальборо");
  const pin = wines(srv).find((x) => x.id === "w-pin");
  ok("ADDED: новое вино из формы — с addedAt (для «Новых вин»); старое при правке — без", !!sb && Math.abs(sb.addedAt - now) < 120e3 && !pin.addedAt, JSON.stringify({ addedAt: sb && sb.addedAt, now }));
  await o.page.locator("[data-wine-import-open]").click(); await sleep(300);
  await o.page.locator('[data-wine-imp="text"]').click(); await sleep(200);
  await o.page.locator("[data-wine-paste]").fill("Гави Ла Сколка\nБароло Пио Чезаре"); await o.page.locator("[data-wine-parse]").click(); await sleep(300);
  await o.page.locator("[data-wine-bare]").click(); await sleep(500);
  await o.page.locator("[data-wine-add]").click(); await sleep(1500);
  const imp = wines(srv).filter((x) => /Ла Сколка|Пио Чезаре/.test(x.name));
  ok("ADDED: импорт — новые вина с addedAt", imp.length === 2 && imp.every((x) => Math.abs(x.addedAt - now) < 120e3), JSON.stringify(imp.map((x) => [x.name, x.addedAt])));
  const [e1, e2] = noErr(o); ok("ADDED: без ошибок", e1, e2);
  await o.ctx.close();
});

// владелец (снимок редактора): «Кнопки слиплись» — у кнопок редактора свой отступ сверху съедался (marginTop из T.doneBtn
// стоял в стиле раньше margin: 0); теперь между кнопками и полем — воздух, кольцо главной кнопки соседей не касается
const gapsOf = (page, pairs) => page.evaluate((pairs) => pairs.map(([a, b]) => { const x = document.querySelector(a), y = document.querySelector(b);
  if (!x || !y) return { a, b, gap: null }; return { a, b, gap: Math.round((y.getBoundingClientRect().top - x.getBoundingClientRect().bottom) * 10) / 10 }; }), pairs);
await run("GAPS", async () => {
  for (const light of [false, true]) {
    const tag = light ? "GAPS «Для чтения»" : "GAPS";
    const srv = srvOf(MENU_T);
    const o = await open({ who: MARIA, srv, menu: MENU_T, light });
    await hideToasts(o.page);
    await toEditor(o.page);
    // v124: «Проверка подряд» — в сводке над кнопками; между сводкой, кнопками и поиском — по-прежнему воздух
    const g1 = await gapsOf(o.page, [["[data-wine-sum-card]", "[data-wine-new]"], ["[data-wine-new]", 'input[type="search"]']]);
    const mt = await o.page.evaluate(() => getComputedStyle(document.querySelector("[data-wine-review-start]")).marginTop);
    ok(`${tag}: «Проверка подряд» не прилипает к «Новое вино» и «Импорт», поле поиска — ниже с отступом`, g1.every((x) => x.gap >= 12) && mt === "12px", JSON.stringify({ g1, mt }));
    if (!light) await shot(o.page, "gaps-editor");
    await o.page.locator("[data-wine-import-open]").click(); await sleep(300);
    const g2 = await gapsOf(o.page, [["[data-wine-new]", "[data-wine-import]"]]);
    await o.page.locator('[data-wine-imp="text"]').click(); await sleep(200);
    await o.page.locator("[data-wine-paste]").fill("Гави Ла Сколка\nБароло Пио Чезаре"); await o.page.locator("[data-wine-parse]").click(); await sleep(300);
    await o.page.locator("[data-wine-bare]").click(); await sleep(500);
    const g3 = await gapsOf(o.page, [["[data-wine-enrich]", "[data-wine-add]"]]);
    const g4 = await o.page.evaluate(() => { const last = [...document.querySelectorAll("[data-wine-found-row]")].pop(), en = document.querySelector("[data-wine-enrich]");
      return last && en ? Math.round((en.getBoundingClientRect().top - last.parentElement.getBoundingClientRect().bottom) * 10) / 10 : null; });
    ok(`${tag}: в импорте — панель ниже кнопок, «Дополнить через AI» и «Добавить» не слиплись`, g2[0].gap >= 12 && g3[0].gap >= 12 && g4 >= 10, JSON.stringify({ g2, g3, g4 }));
    if (!light) await shot(o.page, "gaps-import");
    const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
    await o.ctx.close();
  }
});

// линза и «Для чтения»: пункты тренировки — карточки линзы, лицевая колоды — стекло с краем, «Знал» — главная кнопка;
// подписи читаются (по пикселям), свет карточек их не съедает
const trainLook = async (tag, light) => {
  const P = pal(light);
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T, light });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toHub(o.page);
  const row = await st(o.page, '[data-wine-train="deck"]'), entryCheck = await st(o.page, "[data-wine-hub-check]");
  ok(`${tag}: пункты тренировки — карточки линзы`, !!row && /radial-gradient/.test(row.img) && row.bc === P.EDGE && !!entryCheck, JSON.stringify(row).slice(0, 200));
  const low1 = light ? await pxAll(o.page, ['[data-wine-train="glass"] [style*="white-space: normal"]', "[data-wine-hub-sum]", "[data-wine-review-open]"]) : [];
  const la1 = await lightAudit(o.page);
  await shot(o.page, tag.toLowerCase() + "-hub");
  await hubOpen(o.page, "glass");
  const okBtn = await st(o.page, '[data-wine-mark="ok"]');
  ok(`${tag}: «Знал» — главная кнопка линзы`, light ? !!okBtn && /radial-gradient/.test(okBtn.img) && okBtn.rad === "999px" : isMain(okBtn), JSON.stringify(okBtn).slice(0, 200));
  const low2 = light ? await pxAll(o.page, ['[data-wine-deck-mode="quiz"]', "[data-wine-deck-known] span"]) : [];
  await shot(o.page, tag.toLowerCase() + "-know");
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(600);
  await hubOpen(o.page, "quiz");
  await o.page.locator('[data-wine-opt="0"]').click(); await sleep(300);
  const low3 = light ? await pxAll(o.page, ["[data-wine-why]"]) : [];
  await shot(o.page, tag.toLowerCase() + "-quiz");
  if (light) ok(`${tag}: подписи тренировки читаются (контраст по пикселям)`, !low1.length && !low2.length && !low3.length, JSON.stringify([low1, low2, low3]));
  ok(`${tag}: свет карточек не съедает подписи тренировки`, la1.n > 5 && !la1.out.length, JSON.stringify(la1).slice(0, 300));
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LENS", () => trainLook("LENS", false));
await run("PAPER", () => trainLook("PAPER", true));

await run("NOW", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T, seedExtra: { sa_home_look: "now" } });
  await hideToasts(o.page);
  await toHub(o.page);
  const row = await st(o.page, '[data-wine-train="deck"]');
  await hubOpen(o.page, "deck");
  await o.page.locator("[data-wine-deck-card]").click(); await sleep(1100);
  const d = await deckState(o.page);
  ok("NOW: вид «как сейчас» — тренировка без света линзы, колода переворачивается", !!row && !/radial-gradient/.test(row.img) && d.flip === "back", JSON.stringify({ img: row && row.img, flip: d.flip }));
  await shot(o.page, "now-deck");
  await o.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T, w: 320, h: 700 });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toList(o.page); await sleep(1300);
  const f0 = await fits(o.page);
  await o.page.locator("[data-wine-train-open]").click(); await sleep(700);
  const f1 = await fits(o.page);
  await hubOpen(o.page, "deck");
  await o.page.locator("[data-wine-deck-find]").click(); await sleep(400);
  const f2 = await fits(o.page);
  await shot(o.page, "narrow-deck");
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(600);
  await hubOpen(o.page, "quiz");
  const f3 = await fits(o.page);
  await shot(o.page, "narrow-quiz");
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(600);
  await o.page.locator("[data-wine-review-open]").click(); await sleep(1500);
  const f4 = await fits(o.page);
  await shot(o.page, "narrow-review");
  ok("NARROW: 320 px — карта, тренировка, колода с фильтрами, викторина, проверка подряд без сдвига вбок", [f0, f1, f2, f3, f4].every((f) => f.sw <= f.W), JSON.stringify([f0, f1, f2, f3, f4]));
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
