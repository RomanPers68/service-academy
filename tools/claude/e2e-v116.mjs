// e2e v116 (Доп. 429): «Смена» в линзах. Владелец (30.10): «Пройдёмся по приложению, добьём то, что осталось? Чтобы
// приложение визуально было едино». В виде «Линза» (по умолчанию). Сервер — tools/claude/demo-app/fake-server.js;
// «Спасибо от гостей» и рассадка — своими ответами сервера (в демо этапов 34 и 35 нет). Разделы:
//   CHECK  — чек-листы смены: «Править» — стекло, пункты — карточки; правка: поля, «+ Добавить пункт», «Сохранить»;
//   SOS    — «назад» — линза 32 px (подпись «Назад» скрыта), строка номеров и раскрытая карточка — красная кромка;
//   MENU   — меню-тренажёр: режимы — карточки, режим дня — яркий ободок; викторина: ответы — стекло, верный — зелёный;
//            «Аллергены на скорость»: карточка и «Поехали» — плашка; «Меню по разделам»: поиск, разделы;
//   DECK   — колоды меню и бармена: «Колода / Знаю?» — капсула, выбранная — плашка; поиск и список — линзы; карта —
//            кромка; «назад / дальше» — стекло; «Собрать руками» — плашка;
//   BAR    — «Сборка руками»: карточки, «По памяти» — яркий ободок; карта бара и меню для печати: «Картинкой» — плашка;
//   PRON   — «Как произносить»: поиск, разделы, слова — карточки, «послушать» — линза, «в оригинале» — стекло;
//   DLG    — «Гость недели» (живой диалог): «назад», голос, звук — линзы с кольцом, карточка гостя — кромка и свет,
//            метки и ответы — стекло, выбранный ответ — прежний;
//   THANKS — «Спасибо от гостей»: «Показать гостю» — плашка, остальные — стекло, итоги и спасибо — карточки, вкладки;
//   SEAT   — рассадка: пустой зал — карточка, «Нарисовать схему» — плашка; схема: инструменты, «Сохранить схему»;
//   MENTOR — «Допуск наставника»: допуск — карточка, навыки — кромка; лист навыка: запрос — кромка, «Отправить» — плашка, PIN — стекло;
//   PAPER  — «Для чтения»: тёмное золото у стекла, светлые плашки и ответы диалога; контраст по пикселям не ниже нормы;
//   NOW    — вид «как сейчас»: SOS, чек-лист и диалог прежние;
//   NARROW — 320 px: кольца шапки диалога и колоды в экране.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v116.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v116";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v116";
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

const SOSB = "rgba(234, 140, 140, 0.55)", HI_L = "rgb(107, 78, 26)";
const vis = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].some((x) => x.offsetParent !== null), sel);
const clickText = (page, sel, t) => page.evaluate(([sel, t]) => { const e = [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null && x.textContent.trim().startsWith(t)).pop(); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } return !!e; }, [sel, t]);
const toMode = async (page, key) => { await nav(page, "home", 900); await nav(page, "menuTrainer", 2200); await page.evaluate((k) => { const e = document.querySelector(`[data-menu-mode="${k}"]`); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } }, key); await sleep(1500); };
const THANKS_RPC = (fn) => {
  const at = new Date(Date.now() + SHIFT_MS - 86400e3).toISOString();
  if (fn === "my_thanks") return { ok: true, code: "qr-demo-1", name: "Мария Ким", restaurant: R0, week: 2, month: 5, total: 12, items: [{ id: 1, at, tags: ["service"], text: "Спасибо за тёплый вечер" }] };
  if (fn === "thanks_team") return { ok: true, rows: [{ emp_id: "e-anna", name: "Анна Смирнова", tags: { service: 2 }, week: 2, month: 4 }], items: [{ id: 7, at, name: "Анна Смирнова", text: "Очень внимательно", hidden: false }] };
  if (fn === "review_links") return { ok: true, links: [] };
  return undefined;
};
const SEAT_RPC = (fn) => (fn === "seat_board" ? { ok: true, lead: true, floor: 2, plan: null, tables: [], staff: [] } : undefined);
const HALL_RPC = (fn) => (fn === "skill_requests_mine" ? { ok: true, rows: [] } : undefined);

await run("CHECK", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "checklist", 2400);
  const ed = await st(a.page, await pick(a.page, "[data-lens-btn]", "✎ Править")), it = await st(a.page, await pick(a.page, "[data-lens-card]", "Свет, музыка"));
  ok("CHECK: «Править» — стекло, пункты — карточки линзы", isSoft(ed) && lensCard(it), JSON.stringify([ed, it]));
  await shot(a.page, "check");
  await clickText(a.page, "[data-lens-btn]", "✎ Править"); await sleep(700);
  const f = await st(a.page, 'input[data-lens-field][placeholder="Текст пункта…"]'), add = await st(a.page, await pick(a.page, "button", "+ Добавить пункт")), save = await st(a.page, await pick(a.page, "button", "Сохранить чек-лист"));
  ok("CHECK: правка — поля стекло, «+ Добавить пункт» — стекло, «Сохранить чек-лист» — плашка с кольцом", !!f && f.bg === GLASS && isSoft(add) && isMain(save), JSON.stringify([f, add, save]));
  await shot(a.page, "check-edit");
  const [e1, e2] = noErr(a); ok("CHECK: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("SOS", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "sos", 2200);
  const b = await st(a.page, 'button[data-lens="back"][aria-label="Назад"]');
  const hid = await a.page.evaluate(() => { const s = document.querySelector("[data-lens-hide]"), b = document.querySelector('button[data-lens="back"][aria-label="Назад"]');
    if (!s || !b) return "нет"; const r = b.getBoundingClientRect(), t = b.firstElementChild.getBoundingClientRect();
    return getComputedStyle(s).display + "|" + Math.round(Math.abs((t.left + t.width / 2) - (r.left + r.width / 2))); });
  ok("SOS: «назад» — линза 32 px с кольцом, подпись «Назад» скрыта, стрелка посередине", !!b && b.w === 32 && b.h === 32 && b.bg === GLASS && b.ring === RING && /^none\|[01]$/.test(hid), JSON.stringify([b, hid]));
  const num = await st(a.page, '[data-lens-card="sos"]'), card = await st(a.page, await pick(a.page, '[data-lens-card=""]', "Гость подавился"));
  ok("SOS: строка номеров — красная кромка и красный свет, карточки — золотая кромка", !!num && num.bc === SOSB && /radial-gradient\(.*rgba\(234, 140, 140, 0\.1\)/.test(num.img) && lensCard(card), JSON.stringify([num, card]));
  await clickText(a.page, "div", "Гость подавился"); await sleep(600);
  const n2 = await a.page.locator('[data-lens-card="sos"]').count();
  ok("SOS: раскрытая карточка — красная кромка (строк с ней две)", n2 === 2, String(n2));
  await shot(a.page, "sos");
  const [e1, e2] = noErr(a); ok("SOS: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("MENU", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "menuTrainer", 2400);
  const m = await st(a.page, '[data-menu-mode="quiz"]'), day = await st(a.page, '[data-menu-mode][data-lens-card="hi"], [data-menu-mode][data-lens-card="ok"]');
  ok("MENU: режимы — карточки линзы, режим дня — яркий ободок", lensCard(m) && !!day && (day.bc === HI || /rgba\(138, 216, 175/.test(day.bc)), JSON.stringify([m, day]));
  await shot(a.page, "menu");
  await toMode(a.page, "quiz");
  const o = await st(a.page, '.sa-opt[data-lens-opt=""]');
  ok("MENU: викторина — ответы стекло с ободком", !!o && o.bg === GLASS && o.sh.includes(RIM), JSON.stringify(o));
  await a.page.locator(".sa-opt").first().click(); await sleep(400);
  const marks = await a.page.evaluate(() => [...document.querySelectorAll(".sa-opt")].map((e) => e.getAttribute("data-lens-opt") + "|" + getComputedStyle(e).backgroundColor));
  ok("MENU: после ответа верный — прежний зелёный, неверный — прежний красный", marks.some((x) => x === "ok|rgba(93, 187, 138, 0.15)") && marks.every((x) => !/^(ok|bad)\|rgba\(200, 169, 110, 0\.12\)/.test(x)), marks.join(" · "));
  const nx = await st(a.page, await pick(a.page, "button", "Дальше →"));
  ok("MENU: «Дальше» — плашка с кольцом", isMain(nx), JSON.stringify(nx));
  await toMode(a.page, "sprint");
  const ic = await st(a.page, await pick(a.page, "[data-lens-card]", "30 секунд")), go = await st(a.page, await pick(a.page, "button", "Поехали"));
  ok("MENU: «Аллергены на скорость» — карточка линзы, «Поехали» — плашка", lensCard(ic) && isMain(go), JSON.stringify([ic, go]));
  await shot(a.page, "sprint");
  // предупреждение React о «border» и «borderTop» у ответа викторины после выбора — было и до v116 (стиль T.quizOpt), не линза
  a.errors = a.errors.filter((e) => !/style property during rerender/.test(e));
  const [e1, e2] = noErr(a); ok("MENU: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("DECK", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMode(a.page, "cards");
  const seg = await st(a.page, '[data-lens-seg="flat"]'), tab = await st(a.page, '[data-lens-seg="flat"] [data-lens-btn="tab"]'), d1 = await st(a.page, 'span[data-lens="disc"][aria-label="Поиск и разделы"]');
  const face = await st(a.page, ".sa-ck-front[data-lens-edge]"), nx = await st(a.page, await pick(a.page, "button", "дальше ›"));
  ok("DECK: колода меню — капсула и выбранная плашка, поиск — линза, карта — кромка, «дальше» — стекло",
    !!seg && seg.sh.includes(RIM) && !seg.ring && isTab(tab) && isDisc(d1) && isEdge(face) && isSoft(nx), JSON.stringify([seg, tab, d1, face, nx]));
  await shot(a.page, "deck-menu");
  await nav(a.page, "cocktails", 2400);
  const t2 = await st(a.page, '[data-lens-seg="flat"] [data-lens-btn="tab"]'), f2 = await st(a.page, ".sa-ck-front[data-lens-edge]");
  ok("DECK: колода бармена — плашка «Колода», карта — кромка", isTab(t2) && isEdge(f2), JSON.stringify([t2, f2]));
  await a.page.locator(".sa-ck-wrap").first().click(); await sleep(1100);
  const bld = await st(a.page, await pick(a.page, '[data-lens-btn="main"]', "Собрать руками"));
  ok("DECK: на обороте «Собрать руками» — плашка с кольцом", isMain(bld), JSON.stringify(bld));
  await shot(a.page, "deck-bar");
  const [e1, e2] = noErr(a); ok("DECK: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("BAR", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "barLab", 2400);
  const tl = await st(a.page, '.sa-card[data-lens-card=""]');
  ok("BAR: «Сборка руками» — карточки линзы", lensCard(tl), JSON.stringify(tl));
  await clickText(a.page, ".sa-card", "Коктейль дня"); await sleep(1300);
  const mem = await st(a.page, '[data-lens-card="hi"]');
  ok("BAR: «По памяти» — яркий ободок", !!mem && mem.bc === HI && /radial-gradient/.test(mem.img), JSON.stringify(mem));
  await shot(a.page, "barlab");
  await nav(a.page, "barPrint", 2400);
  const pic = await st(a.page, await pick(a.page, "button", "Картинкой")), txt2 = await st(a.page, await pick(a.page, "button", "Текстом"));
  ok("BAR: карта бара для печати — «Картинкой» плашка, «Текстом» стекло", isMain(pic) && isSoft(txt2), JSON.stringify([pic, txt2]));
  await nav(a.page, "home", 900); await nav(a.page, "menuTrainer", 2200); await clickText(a.page, ".sa-card", "Меню для печати"); await sleep(1500);
  const p2 = await st(a.page, await pick(a.page, "button", "Картинкой")), ph = await st(a.page, await pick(a.page, "[data-lens-btn]", "С фото"));
  ok("BAR: меню для печати — «Картинкой» плашка, «С фото» — стекло с ярким ободком", isMain(p2) && !!ph && ph.bg === GLASS && ph.sh.includes("rgb(232, 201, 131) 0px 0px 0px 1px inset"), JSON.stringify([p2, ph]));
  await shot(a.page, "menuprint");
  const [e1, e2] = noErr(a); ok("BAR: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PRON", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await toMode(a.page, "say");
  const f = await st(a.page, "input.sa-field[data-lens-field]"), cat = await st(a.page, '[data-pron-cat][data-lens-btn="tab"]'), item = await st(a.page, "[data-pron-item][data-lens-card]");
  const say = await st(a.page, '[data-say="ru"][data-lens="disc"]'), orig = await st(a.page, '[data-say="orig"][data-lens-btn="soft"]');
  ok("PRON: поиск — стекло, раздел — плашка, слово — карточка, «послушать» — линза, «в оригинале» — стекло",
    !!f && f.bg === GLASS && isTab(cat) && lensCard(item) && isDisc(say) && isSoft(orig), JSON.stringify([f, cat, item, say, orig]));
  await shot(a.page, "pron");
  const [e1, e2] = noErr(a); ok("PRON: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("DLG", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "weeklyGuest", 3200);
  ok("DLG: «Гость недели» открылся (живой диалог)", await until(() => a.page.locator(".sa-dlg.dc .dc-intro").count(), 9000) > 0);
  const bk = await st(a.page, ".sa-dlg.dc .dc-back"), tl = await st(a.page, ".sa-dlg.dc .dc-tool"), it = await st(a.page, ".sa-dlg.dc .dc-intro"), ch = await st(a.page, ".sa-dlg.dc .dc-chip");
  ok("DLG: «назад», голос и звук — линзы с кольцом; карточка гостя — кромка и свет; метки — стекло",
    isDisc(bk) && bk.w === 34 && isDisc(tl) && !!it && it.bc === EDGE && /radial-gradient/.test(it.img) && !!ch && ch.bg === GLASS, JSON.stringify([bk, tl, it, ch]));
  await until(() => vis(a.page, ".sa-dlg.dc .dc-opt"), 9000);
  const o = await st(a.page, ".sa-dlg.dc .dc-opt");
  ok("DLG: ответы — стекло с ободком и бликом", !!o && o.bg === GLASS && o.sh.includes(RIM) && o.sh.includes(HL), JSON.stringify(o));
  await shot(a.page, "dlg");
  await a.page.locator(".sa-dlg.dc .dc-opt").first().click(); await sleep(250);
  const pk = await a.page.evaluate(() => { const e = document.querySelector(".sa-dlg.dc .dc-opt.pick"); return e ? getComputedStyle(e).backgroundColor : "нет"; });
  ok("DLG: выбранный ответ — прежний золотой (не стекло)", pk === "rgba(214, 178, 102, 0.16)", pk);
  const [e1, e2] = noErr(a); ok("DLG: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("THANKS", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, rpcs: THANKS_RPC });
  await nav(a.page, "thanks", 2600);
  const sh = await st(a.page, "[data-thanks-show]"), sr = await st(a.page, "[data-thanks-share]"), pr = await st(a.page, "[data-thanks-print]");
  const sx = await st(a.page, "[data-thanks-stats]"), it = await st(a.page, "[data-thanks-item]");
  ok("THANKS: «Показать гостю» — плашка, «Поделиться» и «Картинка для печати» — стекло, итоги и спасибо — карточки",
    isMain(sh) && isSoft(sr) && isSoft(pr) && lensCard(sx) && lensCard(it), JSON.stringify([sh, sr, pr, sx, it]));
  const tb = await st(a.page, '[data-thanks-tab="mine"]');
  ok("THANKS: вкладка «Мой QR» — плашка", tb === null || isTab(tb), JSON.stringify(tb));
  await shot(a.page, "thanks");
  const [e1, e2] = noErr(a); ok("THANKS: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("SEAT", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, rpcs: SEAT_RPC });
  await nav(a.page, "seat", 2600);
  const em = await st(a.page, "[data-floor-empty]"), ed = await st(a.page, "[data-floor-edit]");
  ok("SEAT: пустой зал — карточка, «Нарисовать схему» — плашка", lensCard(em) && isMain(ed), JSON.stringify([em, ed]));
  await a.page.locator("[data-floor-edit]").first().click(); await sleep(900);
  const t1 = await st(a.page, '[data-tool][data-lens-btn="tab"]'), t2 = await st(a.page, '[data-tool][data-lens-btn="soft"]'), sv = await st(a.page, "[data-floor-save]");
  ok("SEAT: схема — выбранный инструмент плашка, остальные стекло, «Сохранить схему» — плашка", isTab(t1) && isSoft(t2) && isMain(sv), JSON.stringify([t1, t2, sv]));
  await shot(a.page, "seat-edit");
  const [e1, e2] = noErr(a); ok("SEAT: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("MENTOR", async () => {
  const srv = srvOf();
  const a = await open({ who: KSENIA, srv, rpcs: HALL_RPC });
  await nav(a.page, "mentor", 2600);
  // навыки — кромка без света: на свету номер навыка на линзе опускался ниже нормы
  const sk = await st(a.page, ".sa-card[data-lens-edge]"), pg = await st(a.page, await pick(a.page, "[data-lens-card]", "Новичок"));
  ok("MENTOR: допуск — карточка линзы, навыки — кромка", isEdge(sk) && lensCard(pg), JSON.stringify([sk, pg]));
  await a.page.locator(".sa-card[data-lens-edge]").first().click(); await sleep(900);
  const hb = await st(a.page, "[data-lens-edge]"), send = await st(a.page, await pick(a.page, "button", "Отправить старш")), pin = await st(a.page, 'input[placeholder^="PIN наставника"]'), cn = await st(a.page, await pick(a.page, "button", "Отмена"));
  ok("MENTOR: лист навыка — запрос кромкой, «Отправить старшему» — плашка, PIN — стекло, «Отмена» — стекло",
    isEdge(hb) && isMain(send) && !!pin && pin.bg === GLASS && isSoft(cn), JSON.stringify([hb, send, pin, cn]));
  await shot(a.page, "mentor");
  const [e1, e2] = noErr(a); ok("MENTOR: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, light: true });
  await nav(a.page, "checklist", 2400);
  const edSel = await pick(a.page, "[data-lens-btn]", "✎ Править");
  const ed = await st(a.page, edSel);
  ok("PAPER: «Править» — тёмное золото на светлом стекле", !!ed && ed.color === HI_L, JSON.stringify(ed));
  const r1 = await pxRatio(a.page, edSel);
  await toMode(a.page, "cards");
  const nxSel = await pick(a.page, "button", "дальше ›"), tab = await st(a.page, '[data-lens-seg="flat"] [data-lens-btn="tab"]');
  const r2 = await pxRatio(a.page, nxSel);
  ok("PAPER: колода — выбранная плашка тёмным золотом", !!tab && tab.color === HI_L, JSON.stringify(tab));
  const b = await open({ who: ANNA, srv, light: true });
  await nav(b.page, "weeklyGuest", 3200);
  await until(() => vis(b.page, ".sa-dlg.dc .dc-opt"), 9000);
  const o = await st(b.page, ".sa-dlg.dc .dc-opt"), bk = await st(b.page, ".sa-dlg.dc .dc-back");
  ok("PAPER: диалог — ответы светлое стекло, «назад» тёмным золотом", !!o && o.bg === "rgba(255, 255, 255, 0.55)" && !!bk && bk.color === HI_L, JSON.stringify([o, bk]));
  const r3 = await pxRatio(b.page, ".sa-dlg.dc .dc-opt .dc-opt-t");
  ok("PAPER: контраст по пикселям — «Править», «дальше» колоды, ответ диалога не ниже нормы", [r1, r2, r3].every((r) => !!r && r.r >= r.need), JSON.stringify([r1, r2, r3]));
  await shot(b.page, "paper-dlg");
  const [e1, e2] = noErr(a, b); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, seedExtra: { sa_home_look: "now" } });
  await nav(a.page, "sos", 2200);
  const b = await st(a.page, 'button[data-lens="back"][aria-label="Назад"]'), hv = await vis(a.page, "[data-lens-hide]");
  ok("NOW: SOS — «‹ Назад» словами, как раньше", !!b && b.w > 40 && b.bg === "rgba(0, 0, 0, 0)" && hv, JSON.stringify([b, hv]));
  await nav(a.page, "checklist", 2200);
  const it = await st(a.page, await pick(a.page, "[data-lens-card]", "Свет, музыка"));
  ok("NOW: чек-лист — пункты прежние (без света линзы)", !!it && !/radial-gradient/.test(it.img), JSON.stringify(it));
  const c = await open({ who: ANNA, srv, seedExtra: { sa_home_look: "now" } });
  await nav(c.page, "weeklyGuest", 3200);
  await until(() => c.page.locator(".sa-dlg.dc .dc-back").count(), 9000);
  const bk = await st(c.page, ".sa-dlg.dc .dc-back"), o = await st(c.page, ".sa-dlg.dc .dc-opt");
  ok("NOW: диалог — «назад» без кружка, ответы прежние", !!bk && bk.bg === "rgba(0, 0, 0, 0)" && bk.w === 40 && !bk.ring && (!o || o.bg !== GLASS), JSON.stringify([bk, o]));
  const [e1, e2] = noErr(a, c); ok("NOW: без ошибок", e1, e2);
  await a.ctx.close(); await c.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, w: 320, h: 700 });
  await nav(a.page, "weeklyGuest", 3200);
  await until(() => a.page.locator(".sa-dlg.dc .dc-back").count(), 9000);
  const r1 = await ringIn(a.page, ".sa-dlg.dc .dc-back,.sa-dlg.dc .dc-tool");
  const n1 = await a.page.locator(".sa-dlg.dc .dc-back,.sa-dlg.dc .dc-tool").count();
  const b = await open({ who: MARIA, srv, w: 320, h: 700 });
  await toMode(b.page, "cards");
  const r2 = await ringIn(b.page, '[data-lens="disc"],[data-lens="back"],[data-lens-seg] [data-lens-btn="tab"]');
  const f = await fits(b.page);
  ok("NARROW: 320 px — кольца шапки диалога и колоды в экране, без сдвига вбок", n1 >= 3 && !r1.length && !r2.length && f.sw <= f.W, JSON.stringify([n1, r1, r2, f]));
  await shot(b.page, "narrow-deck");
  await a.ctx.close(); await b.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
