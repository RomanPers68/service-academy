// e2e v119 (Доп. 432): то, что всплывает по событию, в линзах. Владелец (31.10, снимки): «Двоих поймал, без эффекта линзы»
// (новый значок и баннер книги отзывов), «Ну и ещё троих» (полоска номеров тем, поиск и «Сменить», вид «списком»). В виде
// «Линза» (по умолчанию). Сервер — tools/claude/demo-app/fake-server.js;
// «Вопрос дня» — своими ответами сервера (в демо этапа 37 нет). Разделы:
//   TOAST  — новый значок: плашка — карточка линзы на сплошном тоне, парит; «Путь мастера ›» — плашка с кольцом; «закрыть» —
//            линза 32 px в углу;
//   BANNER — баннер «Книга отзывов»: карточка со стеклом и размытием, значок книги — линза, «Читать ›» — плашка, «скрыть» —
//            линза; «Работа над ошибками» над ним — карточка;
//   TRACK  — трек: полоска номеров тем — стекло, «монета» — плашка с ярким ободком; поиск и «Сменить» — стекло; вид «списком»:
//            следующий урок — кромка, «Начать» — плашка, «листать ›» — стекло, темы — карточки, их значки — линзы;
//   UPDATE — «Готова новая версия»: карточка, парит; «Обновить» — плашка;
//   RECAP  — «Итоги месяца»: «закрыть» — линза, «Поделиться картинкой» — плашка, «Поделиться текстом» — стекло;
//   QDAY   — «Вопрос дня»: карточка, ответы — стекло; верный и неверный — прежние;
//   CAL    — «Смены в календаре телефона»: «Подписаться» — плашка, «Скопировать ссылку» — стекло, «Сбросить?» — красная
//            капсула, ближайшие смены — карточка, ссылка — стекло, «закрыть» — линза;
//   HINT   — подсказка: «Понятно» — плашка, значок — линза;
//   VOICE  — голос шефа: «Слушать подряд» и «пауза» — плашки (значок цветом подписи), запись — стекло, блюдо — карточка, плеер —
//            линзы и стекло; запись в форме блюда — кромка, «Записать» — стекло;
//   PAPER  — «Для чтения»: тосты, баннер, вопрос дня, лист календаря; контраст по пикселям не ниже нормы;
//   NOW    — вид «как сейчас»: всё прежнее;
//   NARROW — 320 px: кольца и плашки в экране.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v119.mjs [разделы]
// E2E_LOOK=now — все разделы в виде «как сейчас» (снимки двух сборок для сравнения по пикселям; проверки линзы тогда не про то)
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v119";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v119";
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

const HI_L = "rgb(138, 101, 36)", GLASS_L = "rgba(139, 106, 48, 0.09)";
// виден ли элемент (fixed тоже: у него offsetParent пустой)
const shown = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].some((x) => { const r = x.getBoundingClientRect(), s = getComputedStyle(x);
  return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; }), sel);
const clickText = (page, sel, t) => page.evaluate(([sel, t]) => { const e = [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null && x.textContent.trim().startsWith(t)).pop(); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } return !!e; }, [sel, t]);
const go = async (page, s, ms = 2400) => { await nav(page, "home", 800); await nav(page, s, ms); };
// новые значки всплывают у Анны через 6–20 с после входа — в разделах не про них прячем, чтобы не закрывали низ экрана
const hideToasts = (page) => page.addStyleTag({ content: "[data-ms-toast]{display:none!important}" });
// то, чего нет в st: размер шрифта, размытие, положение и заливка значка
const more = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const s = getComputedStyle(e), r = e.getBoundingClientRect();
  const p = e.querySelector("path"); return { fs: s.fontSize, bf: s.backdropFilter || s.webkitBackdropFilter || "", top: Math.round(r.top), right: Math.round(r.right), fill: p ? getComputedStyle(p).fill : "" }; }, sel);
const toastUp = (page) => until(() => shown(page, ".ms-toast"), 26000, 300);
// подписи на плашках и стекле — по пикселям (фон из снимка): норма 4,5, крупные и полужирные от 14 px — 3
const pxAll = async (page, sels) => { const out = []; for (const s of sels) { const r = await pxRatio(page, s); if (r && r.r < r.need) out.push(r.t + " " + r.r + "/" + r.need); else if (!r) out.push("нет " + s); } return out; };

// «Работа над ошибками» на треке — два вопроса пора повторить
const S0 = (await import(SRC + "/data/modules-seasonal.js")).SEASONAL_MODULES.find((m) => m.id === "s0");
const S0Q = (S0.lessons.find((l) => l.type === "quiz") || {}).questions || [];
const MIST = (uk) => ({ ["sa_mistakes" + uk]: JSON.stringify(S0Q.slice(0, 2).map((q) => ({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "", img: null, lessonTitle: S0.title, lessonId: "s0-q", stage: 0, due: 0 }))) });
const UKA = "_" + ANNA.name + "_" + ANNA.surname;
// «Вопрос дня» (этап 37 — своими ответами)
const QITEM = { id: 7, q: "Через сколько секунд гостя нужно поприветствовать?", o: ["До 30 секунд", "Через 5 минут", "Когда сядет за стол"], t: "Встреча гостя", r: "Официант", via: "app", answer: null, correct: null };
const qdayRpc = () => { const Q = { item: QITEM };
  return (fn, body) => {
    if (fn === "qday_today") return { ok: true, day: TODAY, hour: 12, streak: Q.item.answer == null ? 2 : 3, item: Q.item };
    if (fn === "qday_answer") { Q.item = { ...QITEM, answer: body.p_answer, correct: body.p_answer === 0, c: 0, e: "Первый контакт до 30 секунд: гость видит, что его заметили." }; return { ok: true, item: Q.item, streak: 3 }; }
    return undefined; }; };
// итоги месяца: занятия в этом и прошлом месяце (как e2e-v31)
const ACT = (() => { const a = {}, now = new Date(Date.now() + SHIFT_MS), ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  for (let n = 0; n < now.getDate(); n++) { const d = new Date(now); d.setDate(d.getDate() - n); a[ymd(d)] = { st: 3, l: 2, w: 1 }; }
  a[ymd(new Date(now.getFullYear(), now.getMonth() - 1, 2))] = { st: 1, l: 1 }; return a; })();
const toLast = async (page) => { for (let k = 0; k < 12; k++) { if (await page.locator(".mr-btn").count()) return true; await page.locator('.mr-nav button[aria-label="Дальше"]').click(); await sleep(350); } return false; };
// голос шефа у первого блюда: три секунды тишины (WAV прямо в ссылке — плеер играет без сети)
const WAV = (() => { const sr = 8000, n = sr * 3, b = Buffer.alloc(44 + n); b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return "data:audio/wav;base64," + b.toString("base64"); })();
const MENU_V = JSON.parse(JSON.stringify(MENU));
{ const d = MENU_V.find((x) => x && x.name && x.kind !== "cocktail" && !x.stop); d.voice = { chef: { url: WAV, sec: 3, name: "Алексей", at: Date.now() - 864e5 }, som: { url: WAV, sec: 3, name: "Мария", at: Date.now() - 864e5 } }; }

await run("TOAST", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "roleSelect", 1200);
  const up = await toastUp(a.page);
  ok("TOAST: новый значок всплыл (раздел «Психология первого дня» пройден)", up);
  const t = await st(a.page, ".ms-toast"), b = await st(a.page, '.ms-toast [data-lens-btn="main"]'), x = await st(a.page, ".ms-toast [data-lens-x]");
  const tm = await more(a.page, ".ms-toast"), xm = await more(a.page, ".ms-toast [data-lens-x]");
  await shot(a.page, "toast");
  ok("TOAST: плашка — карточка линзы (свет сверху, кромка) на сплошном тоне, парит (тень глубже)", lensCard(t) && t.bg === "rgb(39, 29, 15)" && /36px/.test(t.sh), JSON.stringify(t));
  ok("TOAST: «Путь мастера ›» — плашка с кольцом", isMain(b), JSON.stringify(b));
  ok("TOAST: «закрыть» — линза 32 px, центр там же, где у прежней кнопки 44 px (25 px от верха и правого края)", isDisc(x) && x.w === 32 && x.h === 32 && !!tm && !!xm && xm.top - tm.top + 16 === 25 && tm.right - xm.right + 16 === 25, JSON.stringify([x, tm, xm]));
  await a.page.locator(".ms-toast [data-lens-x]").click(); await sleep(600);
  ok("TOAST: «закрыть» закрывает", !(await shown(a.page, ".ms-toast")) || (await a.page.locator(".ms-toast").count()) <= 1);
  const [e1, e2] = noErr(a); ok("TOAST: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("BANNER", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, seedExtra: MIST(UKA) });
  await hideToasts(a.page);
  await nav(a.page, "home", 2400);
  if (!(await shown(a.page, ".sa-bookbanner"))) { await a.page.evaluate(() => { const b = [...document.querySelectorAll(".tbp-num")].find((x) => x.textContent.trim() === "0"); if (b) b.click(); }); await sleep(900); }
  ok("BANNER: на странице пройденного раздела — баннер «Книга отзывов»", await until(() => shown(a.page, ".sa-bookbanner"), 6000));
  const bn = await st(a.page, ".sa-bookbanner"), bm = await more(a.page, ".sa-bookbanner"), ic = await st(a.page, '.sa-bookbanner [data-lens="glyph"]');
  const rd = await st(a.page, '.sa-bookbanner [data-lens-btn="main"]'), x = await st(a.page, ".sa-bookbanner [data-lens-x]"), xm = await more(a.page, ".sa-bookbanner [data-lens-x]");
  const mi = await st(a.page, ".tbp-mist"), cel = await st(a.page, ".tbm-cellar");
  await shot(a.page, "banner");
  ok("BANNER: карточка линзы со стеклом и размытием, парит", lensCard(bn) && /blur\(14px\)/.test(bm.bf) && /36px/.test(bn.sh), JSON.stringify([bn, bm]));
  ok("BANNER: значок книги — линза с кольцом", !!ic && ic.bg === "rgba(214, 178, 102, 0.1)" && ic.ring === "rgba(214, 178, 102, 0.42)" && ic.bc === "rgba(0, 0, 0, 0)", JSON.stringify(ic));
  ok("BANNER: «Читать ›» — плашка с кольцом", isMain(rd), JSON.stringify(rd));
  ok("BANNER: «скрыть» — линза 32 px, крестик прежнего размера (13 px)", isDisc(x) && x.w === 32 && !!xm && xm.fs === "13px", JSON.stringify([x, xm]));
  ok("BANNER: «Работа над ошибками» над баннером — карточка линзы", lensCard(mi), JSON.stringify(mi));
  ok("BANNER: у пройденной темы «Погреб тем ›» — стекло", isSoft(cel), JSON.stringify(cel));
  const top = await onTop(a.page, '.sa-bookbanner [data-lens-btn="main"]');
  ok("BANNER: кольцо «Читать» не закрывает кнопку", top === "да", top);
  await a.page.locator(".sa-bookbanner [data-lens-x]").click(); await sleep(700);
  ok("BANNER: «скрыть» прячет баннер", !(await shown(a.page, ".sa-bookbanner")));
  const [e1, e2] = noErr(a); ok("BANNER: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("TRACK", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await hideToasts(a.page);
  await nav(a.page, "home", 2400);
  const cap = await st(a.page, ".tbp-strip .tbp-cap"), ind = await st(a.page, ".tbp-strip .tbp-ind");
  const dig = await a.page.evaluate(() => { const e = document.querySelector(".tbp-strip .tbp-ind-row span"); return e ? getComputedStyle(e).color : ""; });
  const se = await st(a.page, 'button[aria-label="Поиск"][data-lens-btn]'), ch = await st(a.page, await pick(a.page, "button", "Сменить"));
  await shot(a.page, "track-strip");
  ok("TRACK: полоска номеров — стекло с ободком; «монета» — плотная плашка с ярким ободком, цифры золотом",
    !!cap && cap.bg === GLASS && cap.sh.includes(RIM) && cap.bc === "rgba(0, 0, 0, 0)" && !!ind && /radial-gradient/.test(ind.img) && ind.bg === "rgb(43, 33, 18)" && ind.sh.includes(PILL) && dig === HI, JSON.stringify([cap, ind, dig]));
  ok("TRACK: поиск и «Сменить» в шапке — стекло", isSoft(se) && isSoft(ch), JSON.stringify([se, ch]));
  await a.page.locator(".tbp-strip .tbp-view").first().click(); await sleep(900);
  const nx = await st(a.page, ".sa-card[data-lens-edge]"), gb = await st(a.page, '.sa-card[data-lens-edge] [data-lens-btn="main"]');
  const fl = await st(a.page, 'button[aria-label="Листать темы по одной"]'), mc = await st(a.page, ".sa-card.sa-glass[data-lens-card]"), mi = await st(a.page, '.sa-card.sa-glass[data-lens-card] > [data-lens="disc"]');
  await shot(a.page, "track-list");
  ok("TRACK: «списком» — следующий урок кромкой (свой градиент), «Начать» — плашка с кольцом", isEdge(nx) && /linear-gradient/.test(nx.img) && isMain(gb), JSON.stringify([nx, gb]));
  ok("TRACK: «листать ›» — стекло с подписью золотом, темы — карточки, их значки — круглые линзы", isSoft(fl) && fl.color === GOLD_L && lensCard(mc) && isDisc(mi) && mi.rad === "50%", JSON.stringify([fl, mc, mi]));
  const la = await lightAudit(a.page);
  ok("TRACK: свет карточек тем не съедает подписи", !la.out.length, JSON.stringify(la));
  const [e1, e2] = noErr(a); ok("TRACK: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("UPDATE", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await hideToasts(a.page);
  await nav(a.page, "roleSelect", 1600);
  await a.page.evaluate(() => { window.__saUpdateReady = true; window.dispatchEvent(new CustomEvent("sa-update-ready")); }); await sleep(600);
  const t = await st(a.page, "[data-update-toast]"), b = await st(a.page, "[data-update-now]");
  await shot(a.page, "update");
  ok("UPDATE: «Готова новая версия» — карточка линзы, парит", lensCard(t) && /36px/.test(t.sh), JSON.stringify(t));
  ok("UPDATE: «Обновить» — плашка с кольцом", isMain(b), JSON.stringify(b));
  const [e1, e2] = noErr(a); ok("UPDATE: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("RECAP", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, seedExtra: { ["sa_activity" + UKA]: JSON.stringify(ACT) } });
  await hideToasts(a.page);
  await go(a.page, "me", 1600);
  await a.page.locator('.sa-card[aria-label="Итоги месяца"]').first().click(); await sleep(900);
  const x = await st(a.page, ".mr-x");
  ok("RECAP: «закрыть» историй — линза с кольцом", isDisc(x) && x.w === 36, JSON.stringify(x));
  ok("RECAP: дошли до последней карточки", await toLast(a.page));
  await sleep(400);
  const pic = await st(a.page, ".mr-btn[data-recap-pic]"), tx = await st(a.page, "[data-recap-text]");
  await shot(a.page, "recap");
  ok("RECAP: «Поделиться картинкой» — плашка с кольцом, «Поделиться текстом» — стекло", isMain(pic) && isSoft(tx), JSON.stringify([pic, tx]));
  const [e1, e2] = noErr(a); ok("RECAP: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("QDAY", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, rpcs: qdayRpc() });
  await hideToasts(a.page);
  await nav(a.page, "roleSelect", 1600);
  ok("QDAY: «Вопрос дня» на «Учусь»", await until(() => shown(a.page, "[data-qday-card]"), 9000));
  await a.page.evaluate(() => document.querySelector("[data-qday-card]").scrollIntoView({ block: "center" })); await sleep(400);
  const c = await st(a.page, "[data-qday-card]"), o = await st(a.page, '[data-qday-opt="1"]');
  await shot(a.page, "qday-ask");
  ok("QDAY: карточка линзы, ответы — стекло с ободком", lensCard(c) && !!o && o.bg === GLASS && o.sh.includes(RIM) && o.bc === "rgba(0, 0, 0, 0)", JSON.stringify([c, o]));
  await a.page.locator('[data-qday-opt="2"]').click(); await sleep(900);
  const r = await st(a.page, '[data-qday-opt="0"][data-state="right"]'), w = await st(a.page, '[data-qday-opt="2"][data-state="wrong"]'), i = await st(a.page, '[data-qday-opt="1"]');
  await shot(a.page, "qday-done");
  ok("QDAY: после ответа верный и неверный — прежние (золото и красный), остальное — стекло", !!r && r.bg === "rgba(210, 168, 90, 0.16)" && r.bc === "rgb(210, 168, 90)" && !!w && w.bg === "rgba(224, 138, 122, 0.12)" && !!i && i.bg === GLASS, JSON.stringify([r, w, i]));
  const [e1, e2] = noErr(a); ok("QDAY: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("CAL", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await hideToasts(a.page);
  await nav(a.page, "shift", 1600);
  await a.page.getByText("Смены в календаре телефона").first().click();
  ok("CAL: лист готов", await until(async () => (await a.page.locator("[data-cal-sheet='ready']").count()) === 1, 6000));
  const sub = await st(a.page, "[data-cal-sub]"), cp = await st(a.page, "[data-cal-copy]"), rs = await st(a.page, "[data-cal-reset]"), nx = await st(a.page, "[data-cal-next]");
  const url = await st(a.page, "[data-cal-url]"), x = await st(a.page, "[data-cal-sheet] [data-lens-x]");
  await shot(a.page, "cal");
  ok("CAL: «Подписаться» — плашка, «Скопировать ссылку» и «Сбросить ссылку» — стекло", isMain(sub) && isSoft(cp) && isSoft(rs), JSON.stringify([sub, cp, rs]));
  ok("CAL: ближайшие смены — карточка, ссылка — стекло, «закрыть» — линза 32 px", lensCard(nx) && !!url && url.bg === GLASS && isDisc(x) && x.w === 32, JSON.stringify([nx, url, x]));
  await a.page.locator("[data-cal-reset]").click(); await sleep(300);
  const rs2 = await st(a.page, "[data-cal-reset]");
  ok("CAL: переспрос «Сбросить?» — прежний красный, капсулой (не стекло)", !!rs2 && rs2.rad === "999px" && rs2.bg !== GLASS && rs2.color !== HI && /^rgb\((2[0-5]\d|1[5-9]\d), /.test(rs2.color) && rs2.bc === rs2.color, JSON.stringify(rs2));
  const [e1, e2] = noErr(a); ok("CAL: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("HINT", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, hints: false });
  await hideToasts(a.page);
  await nav(a.page, "roleSelect", 1200);
  ok("HINT: подсказка показана", await until(() => shown(a.page, ".sa-hintglow"), 9000));
  const b = await st(a.page, '.sa-hintglow [data-lens-btn="main"]'), g = await st(a.page, '.sa-hintglow [data-lens="glyph"]');
  await shot(a.page, "hint");
  ok("HINT: «Понятно» — плашка с кольцом, значок — линза", isMain(b) && !!g && g.ring === "rgba(214, 178, 102, 0.42)" && g.bg === "rgba(214, 178, 102, 0.1)", JSON.stringify([b, g]));
  const [e1, e2] = noErr(a); ok("HINT: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("VOICE", async () => {
  const srv = srvOf(MENU_V);
  const a = await open({ who: ANNA, srv, menu: MENU_V });
  await hideToasts(a.page);
  await go(a.page, "menuTrainer", 2000);
  await a.page.locator('[data-menu-mode="voices"]').first().click(); await sleep(900);
  const all = await st(a.page, "[data-voices-all]"), pill = await st(a.page, '[data-voices-dish] [data-voice="chef"]'), dish = await st(a.page, "[data-voices-dish]");
  const am = await more(a.page, "[data-voices-all]");
  await shot(a.page, "voices");
  ok("VOICE: «Слушать подряд» — плашка с кольцом, значок — цветом подписи", isMain(all) && !!am && am.fill === HI, JSON.stringify([all, am]));
  ok("VOICE: блюдо — карточка, запись — стекло", lensCard(dish) && isSoft(pill), JSON.stringify([dish, pill]));
  await a.page.locator("[data-voices-all]").click(); await sleep(500);
  ok("VOICE: плеер внизу", await until(() => shown(a.page, "[data-voices-player]"), 4000));
  const ps = await st(a.page, "[data-voices-pause]"), pm = await more(a.page, "[data-voices-pause]"), pv = await st(a.page, '[data-voices-player] [data-lens="disc"]'), rt = await st(a.page, "[data-voices-rate]");
  const hi = await st(a.page, '[data-voices-dish][data-lens-card="hi"]');
  await shot(a.page, "voices-player");
  ok("VOICE: «пауза» — плашка с кольцом, значок — цветом подписи; соседние — линзы, скорость — стекло", isMain(ps) && !!pm && pm.fill === HI && isDisc(pv) && isSoft(rt), JSON.stringify([ps, pm, pv, rt]));
  ok("VOICE: блюдо, что звучит, — яркий ободок", !!hi && hi.bc === HI, JSON.stringify(hi));
  await a.page.locator("[data-voices-all]").click(); await sleep(300);
  const [e1, e2] = noErr(a); ok("VOICE: без ошибок", e1, e2);
  await a.ctx.close();
  // запись в форме блюда (руководитель)
  const m = await open({ who: MARIA, srv: srvOf(MENU_V), menu: MENU_V });
  await hideToasts(m.page);
  await go(m.page, "menuTrainer", 2200); await clickText(m.page, ".sa-card", "Редактор меню"); await sleep(1800);
  await clickText(m.page, "button", "+ Добавить блюдо"); await sleep(1000);
  await m.page.evaluate(() => { const e = document.querySelector('[data-voice-rec="chef"]'); if (e) e.scrollIntoView({ block: "center" }); }); await sleep(400);
  const rec = await st(m.page, '[data-voice-rec="chef"]'), wr = await st(m.page, '[data-voice-rec="chef"] [data-lens-btn]');
  await shot(m.page, "voice-rec");
  ok("VOICE: запись в форме блюда — кромка; «Записать» (если телефон пишет) — стекло", isEdge(rec) && (!wr || isSoft(wr)), JSON.stringify([rec, wr]));
  const [f1, f2] = noErr(m); ok("VOICE: форма без ошибок", f1, f2);
  await m.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, light: true, seedExtra: MIST(UKA), rpcs: qdayRpc() });
  await nav(a.page, "roleSelect", 1200);
  ok("PAPER: значок всплыл", await toastUp(a.page));
  const t = await st(a.page, ".ms-toast");
  const lowT = await pxAll(a.page, ['.ms-toast [data-lens-btn="main"]']);
  await shot(a.page, "paper-toast");
  ok("PAPER: плашка значка — светлый сплошной тон, «Путь мастера ›» читается", !!t && t.bg === "rgb(250, 241, 222)" && /30px/.test(t.sh) && !lowT.length, JSON.stringify([t, lowT]));
  await a.page.locator(".ms-toast [data-lens-x]").click().catch(() => {}); await sleep(400);
  await hideToasts(a.page);
  await until(() => shown(a.page, "[data-qday-card]"), 6000);
  const lowQ = await pxAll(a.page, ['[data-qday-opt="0"] span:nth-of-type(2)', '[data-qday-opt="1"] span:nth-of-type(2)']);
  const la = await lightAudit(a.page);
  await shot(a.page, "paper-qday");
  ok("PAPER: «Вопрос дня» — ответы на светлом стекле читаются, свет карточки не съедает подписи", !lowQ.length && !la.out.length, JSON.stringify([lowQ, la]));
  await nav(a.page, "home", 2400);
  if (!(await shown(a.page, ".sa-bookbanner"))) { await a.page.evaluate(() => { const b = [...document.querySelectorAll(".tbp-num")].find((x) => x.textContent.trim() === "0"); if (b) b.click(); }); await sleep(900); }
  const lowB = await pxAll(a.page, ['.sa-bookbanner [data-lens-btn="main"]']);
  const lb = await lightAudit(a.page);
  await shot(a.page, "paper-banner");
  ok("PAPER: баннер — «Читать ›» читается, свет не съедает подписи", !lowB.length && !lb.out.length, JSON.stringify([lowB, lb]));
  const lowS = await pxAll(a.page, ['button[aria-label="Поиск"][data-lens-btn]', await pick(a.page, "button", "Сменить")]);
  const ind = await st(a.page, ".tbp-strip .tbp-ind");
  ok("PAPER: трек — «монета» светлая плотная, «Сменить» читается", !!ind && ind.bg === "rgb(244, 234, 211)" && /radial-gradient/.test(ind.img) && !lowS.length, JSON.stringify([ind, lowS]));
  await a.page.locator(".tbp-strip .tbp-view").first().click(); await sleep(900);
  const lowL = await pxAll(a.page, ['.sa-card[data-lens-edge] [data-lens-btn="main"]', 'button[aria-label="Листать темы по одной"]']);
  const ll = await lightAudit(a.page);
  await shot(a.page, "paper-track-list");
  ok("PAPER: «списком» — «Начать» и «листать ›» читаются, свет карточек не съедает подписи", !lowL.length && !ll.out.length, JSON.stringify([lowL, ll]));
  await a.page.locator('button[aria-label="Листать темы по одной"]').click(); await sleep(700);
  await a.page.evaluate(() => { window.__saUpdateReady = true; window.dispatchEvent(new CustomEvent("sa-update-ready")); }); await sleep(600);
  const lowU = await pxAll(a.page, ["[data-update-now]"]);
  ok("PAPER: «Обновить» читается", !lowU.length, JSON.stringify(lowU));
  await nav(a.page, "shift", 1600);
  await a.page.getByText("Смены в календаре телефона").first().click();
  await until(async () => (await a.page.locator("[data-cal-sheet='ready']").count()) === 1, 6000);
  const lowC = await pxAll(a.page, ["[data-cal-sub]", "[data-cal-copy]", "[data-cal-reset]"]);
  await shot(a.page, "paper-cal");
  ok("PAPER: лист календаря — «Подписаться», «Скопировать ссылку», «Сбросить ссылку» читаются", !lowC.length, JSON.stringify(lowC));
  const [e1, e2] = noErr(a); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close();
  const h = await open({ who: ANNA, srv: srvOf(MENU_V), light: true, hints: false, menu: MENU_V });
  await hideToasts(h.page);
  await nav(h.page, "roleSelect", 1200);
  await until(() => shown(h.page, ".sa-hintglow"), 9000);
  const lowH = await pxAll(h.page, ['.sa-hintglow [data-lens-btn="main"]']);
  await shot(h.page, "paper-hint");
  ok("PAPER: «Понятно» в подсказке читается", !lowH.length, JSON.stringify(lowH));
  await go(h.page, "menuTrainer", 2000);
  await h.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^sa_hint_/.test(k)) localStorage.setItem(k, "1"); });
  await h.page.locator('[data-menu-mode="voices"]').first().click(); await sleep(900);
  const lowV = await pxAll(h.page, ["[data-voices-all]", '[data-voices-dish] [data-voice="chef"]']);
  await shot(h.page, "paper-voices");
  ok("PAPER: «Слушать подряд» и запись голоса читаются", !lowV.length, JSON.stringify(lowV));
  const [g1, g2] = noErr(h); ok("PAPER: подсказка и голоса без ошибок", g1, g2);
  await h.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf(MENU_V);
  const a = await open({ who: ANNA, srv, seedExtra: { sa_home_look: "now", ...MIST(UKA) }, rpcs: qdayRpc(), menu: MENU_V });
  await nav(a.page, "roleSelect", 1200);
  await toastUp(a.page);
  const t = await st(a.page, ".ms-toast"), b = await st(a.page, ".ms-toast .sa-btn"), x = await st(a.page, '.ms-toast button[aria-label="Закрыть"]');
  ok("NOW: значок — прежний (свой градиент, золотая кнопка, «закрыть» 44 px)", !!t && /linear-gradient/.test(t.img) && !/radial/.test(t.img) && !!b && /linear-gradient/.test(b.img) && !b.ring && !!x && x.w === 44, JSON.stringify([t, b, x]));
  await a.page.locator('.ms-toast button[aria-label="Закрыть"]').click().catch(() => {}); await sleep(400);
  await hideToasts(a.page);
  await until(() => shown(a.page, "[data-qday-card]"), 6000);
  const q = await st(a.page, "[data-qday-card]"), o = await st(a.page, '[data-qday-opt="1"]');
  ok("NOW: «Вопрос дня» — прежний", !!q && !/radial/.test(q.img) && !!o && o.bg === "rgba(0, 0, 0, 0)", JSON.stringify([q, o]));
  await nav(a.page, "home", 2400);
  if (!(await shown(a.page, ".sa-bookbanner"))) { await a.page.evaluate(() => { const b = [...document.querySelectorAll(".tbp-num")].find((x) => x.textContent.trim() === "0"); if (b) b.click(); }); await sleep(900); }
  const cp = await st(a.page, ".tbp-strip .tbp-cap"), ci = await st(a.page, ".tbp-strip .tbp-ind");
  ok("NOW: полоска номеров — прежняя («морозный лёд» и золотая монета)", !!cp && cp.bg === "rgba(226, 186, 116, 0.07)" && !!ci && /linear-gradient/.test(ci.img) && !/radial/.test(ci.img), JSON.stringify([cp, ci]));
  const bn = await st(a.page, ".sa-bookbanner"), rd = await st(a.page, ".sa-bookbanner button");
  ok("NOW: баннер книги — прежний (золотая кромка, золотая «Читать»)", !!bn && bn.bc === "rgba(220, 180, 95, 0.65)" && !/radial/.test(bn.img) && !!rd && /linear-gradient/.test(rd.img) && !rd.ring, JSON.stringify([bn, rd]));
  await a.page.evaluate(() => { window.__saUpdateReady = true; window.dispatchEvent(new CustomEvent("sa-update-ready")); }); await sleep(600);
  const u = await st(a.page, "[data-update-now]");
  ok("NOW: «Обновить» — прежняя золотая", !!u && /linear-gradient/.test(u.img) && !u.ring, JSON.stringify(u));
  await nav(a.page, "shift", 1600);
  await a.page.getByText("Смены в календаре телефона").first().click();
  await until(async () => (await a.page.locator("[data-cal-sheet='ready']").count()) === 1, 6000);
  const s = await st(a.page, "[data-cal-sub]"), c = await st(a.page, "[data-cal-copy]");
  ok("NOW: лист календаря — прежний", !!s && /linear-gradient/.test(s.img) && !s.ring && !!c && c.bg === "rgba(0, 0, 0, 0)", JSON.stringify([s, c]));
  await a.page.locator("[data-cal-sheet] [data-sa-back]").click(); await sleep(400);
  await go(a.page, "menuTrainer", 2000);
  await a.page.locator('[data-menu-mode="voices"]').first().click(); await sleep(900);
  const v = await st(a.page, "[data-voices-all]"), p = await st(a.page, '[data-voices-dish] [data-voice="chef"]');
  ok("NOW: голоса — прежние (залитая «Слушать подряд» цветом меню, запись с кромкой)", !!v && v.bg === "rgb(143, 184, 144)" && !/radial/.test(v.img) && !v.ring && !!p && p.bg === "rgba(255, 248, 230, 0.06)" && p.bc === "rgba(143, 184, 144, 0.467)", JSON.stringify([v, p]));
  const [e1, e2] = noErr(a); ok("NOW: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, w: 320, h: 700, seedExtra: MIST(UKA) });
  await nav(a.page, "roleSelect", 1200);
  await toastUp(a.page);
  const f0 = await fits(a.page), r0 = await ringIn(a.page, '.ms-toast [data-lens-btn="main"],.ms-toast [data-lens-x]');
  await shot(a.page, "narrow-toast");
  await a.page.locator(".ms-toast [data-lens-x]").click().catch(() => {}); await sleep(400);
  await hideToasts(a.page);
  await nav(a.page, "home", 2400);
  if (!(await shown(a.page, ".sa-bookbanner"))) { await a.page.evaluate(() => { const b = [...document.querySelectorAll(".tbp-num")].find((x) => x.textContent.trim() === "0"); if (b) b.click(); }); await sleep(900); }
  const f1 = await fits(a.page), r1 = await ringIn(a.page, '.sa-bookbanner [data-lens-btn="main"],.sa-bookbanner [data-lens]');
  await shot(a.page, "narrow-banner");
  ok("NARROW: 320 px — значок и баннер без сдвига вбок, кольца в экране", f0.sw <= f0.W && f1.sw <= f1.W && !r0.length && !r1.length, JSON.stringify([f0, r0, f1, r1]));
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
