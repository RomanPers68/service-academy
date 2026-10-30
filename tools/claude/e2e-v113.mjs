// e2e v113 (Доп. 426): линзы на экранах, которые владелец показал 30.10 (снимки и записи): «Ещё брифинг, живой гость и
// случай из нашего зала», «И график», «Так же, AI HR, команда и глоссарий», «Так же наставник». В виде «Линза» (по умолчанию).
// Сервер — tools/claude/demo-app/fake-server.js (как e2e-v110–v112). Разделы:
//   BRIEF  — блоки брифинга — карточки линзы; «Отправить команде» — плашка с кольцом, «Провести» — стекло, «Своё» — поле;
//            показ: «закрыть» — линза 32 px с кольцом, «Дальше» — плашка;
//   CASES  — случаи: карточки — линзы, «Рассказать случай» — стекло, поля — стекло, «Отправить» — плашка;
//   GUEST  — «Живой гость»: оболочка .tb-guest, «закрыть» и значок — линзы с кольцом, «Подойти к гостю» — плашка, поле реплики —
//            стекло, микрофон — тонкое кольцо, «Разговор голосом» — золотая линза;
//   SCHED  — график руководителя: вкладки — капсула с кольцом, выбранная — плашка; «неделя / месяц» — без кольца; «Заполнить
//            черновик» — плашка; карточки — кромка без света; разделы — кромка; «Настройки»: номера шагов — линзы, поля — стекло;
//   STAFF  — график сотрудника: карточка смены — кромка, итоги месяца — кромка и свой градиент; «Чек-лист смены» — плашка,
//            «Кто со мной» — стекло; «месяц / списком» — плашка; «Отметить период» — стекло, при отметке ободок ярче;
//   TEAM   — «Команда» у владельца: люди — карточки, «Владелец» словами, «+ Добавить» — плашка, итоги — кромка, поиск — стекло;
//            сотрудник: аватар с кольцом, «Сбросить код» — плашка, «Удалить из команды» — прежний красный, капсулой;
//   HR     — «Собеседование»: «Начать собеседование» — плашка, строка AI HR — карточка; «Проверка AI HR» — карточки, «Запустить
//            проверку» — плашка; выбранная роль — яркий ободок, поле имени — стекло;
//   GLOSS  — «Глоссарий»: поиск — стекло, термины — карточки, «Только избранное» — стекло, включено — плашка; звёздочка прежняя;
//   MENTOR — «Наставник»: кнопки шапки и значок AI — линзы с кольцом, готовые вопросы — карточки, строка ввода — стекло (в фокусе
//            ярче), микрофон — кольцо, «Разговор голосом» — золотая линза;
//   PAPER  — «Для чтения»: тёмное золото у плашек, кромки и стекла; NOW — вид «как сейчас»: всё прежнее (без колец и кромок);
//   LIGHT  — свет карточек не опускает подписи ниже нормы (4,5 и 3 для крупных), если без света норма была;
//   CONTRAST — по пикселям снимка: выбранные вкладки и стекло в «Для чтения», «Ещё» графика в тёмной — не ниже 4,5;
//   NARROW — 320 px: без сдвига вбок, кольца в экране.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v113.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v113";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v113";
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

await run("BRIEF", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "brief", 2200);
  ok("BRIEF: брифинг открылся — блоки на месте", !!(await until(() => a.page.locator("[data-brief-block]").count(), 9000)));
  const b = await st(a.page, "[data-brief-block]");
  ok("BRIEF: блок — карточка линзы: золотая кромка, свет сверху, блик", lensCard(b) && b.sh.includes(HL), JSON.stringify(b));
  const pub = await st(a.page, "[data-brief-publish]"), pr = await st(a.page, "[data-brief-present]");
  ok("BRIEF: «Отправить команде» — плашка с кольцом, «Провести» — стекло", isMain(pub) && isSoft(pr), JSON.stringify([pub, pr]));
  const ta = await st(a.page, "[data-brief-block] textarea");
  ok("BRIEF: «Своё» — поле-стекло", !!ta && ta.bg === GLASS && ta.sh.includes(RIM), JSON.stringify(ta));
  await a.page.locator("[data-brief-present]").click(); await sleep(1000);
  const x = await st(a.page, "[data-lens-x]"), nx = await st(a.page, "[data-brief-next]");
  ok("BRIEF: показ — «закрыть» линза 32 px с кольцом, «Дальше» — плашка с кольцом", !!x && x.w === 32 && x.h === 32 && x.ring === RING && x.bg === GLASS && x.color === GOLD_L && isMain(nx), JSON.stringify([x, nx]));
  ok("BRIEF: «закрыть» не закрыт кольцами соседей (нажимается)", (await onTop(a.page, "[data-lens-x]")) === "да");
  await shot(a.page, "brief-show");
  const [e1, e2] = noErr(a); ok("BRIEF: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("CASES", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "cases", 2200);
  await until(() => a.page.locator("[data-case-tell-open]").count(), 9000);
  const n = await a.page.locator("[data-lens-card]").count(), c = await st(a.page, "[data-lens-card]");
  ok("CASES: карточки случаев — линзы", n >= 2 && lensCard(c), n + " " + JSON.stringify(c));
  const tell = await st(a.page, "[data-case-tell-open]");
  ok("CASES: «Рассказать случай» — стекло", isSoft(tell), JSON.stringify(tell));
  await a.page.locator("[data-case-tell-open]").click(); await sleep(800);
  const f = await st(a.page, "[data-case-field]"), send = await st(a.page, "[data-case-send]");
  ok("CASES: поля — стекло, «Отправить» — плашка с кольцом", !!f && f.bg === GLASS && f.sh.includes(RIM) && isMain(send), JSON.stringify([f, send]));
  await shot(a.page, "cases-tell");
  const [e1, e2] = noErr(a); ok("CASES: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("GUEST", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "shift", 1600);
  await until(() => a.page.locator('.sa-card[aria-label="Живой гость"]').count(), 8000);
  await a.page.locator('.sa-card[aria-label="Живой гость"]').first().click();
  await until(() => a.page.locator(".tb-guest .tb-x").count(), 9000); await sleep(700);
  const cls = await a.page.evaluate(() => (document.querySelector(".tb") || {}).className || "");
  const x = await st(a.page, ".tb-guest .tb-x"), av = await st(a.page, ".tb-guest .tb-av"), m = await st(a.page, ".tb-guest .tb-main");
  ok("GUEST: оболочка .tb-guest; «закрыть» и значок гостя — линзы с кольцом, значок золотом", cls === "tb tb-guest" && !!x && x.bg === GLASS && x.ring === RING && x.color === GOLD_L
    && !!av && av.bg === GLASS && av.ring === RING, cls + " " + JSON.stringify([x, av]));
  ok("GUEST: «Подойти к гостю» — плашка с кольцом, надпись золотом", !!m && /radial-gradient/.test(m.img) && m.color === HI && m.ring === RING, JSON.stringify(m));
  await shot(a.page, "guest-card");
  await a.page.locator(".tb-guest .tb-main").click();
  await until(() => a.page.locator(".tb-guest .lg-in").count(), 9000); await sleep(800);
  const inp = await st(a.page, ".tb-guest .lg-in"), mic = await st(a.page, '.tb-guest [data-lens="mic"]'), talk = await st(a.page, ".tb-guest [data-talk-open]");
  ok("GUEST: поле реплики — стекло с ободком", !!inp && inp.bg === GLASS && inp.sh.includes(RIM), JSON.stringify(inp));
  ok("GUEST: микрофон — тонкое кольцо", !!mic && mic.ring === RING, JSON.stringify(mic));
  ok("GUEST: «Разговор голосом» — золотая линза с кольцом (если в браузере есть голос)", !talk || (/radial-gradient/.test(talk.img) && talk.color === HI && talk.ring === RING), JSON.stringify(talk));
  await shot(a.page, "guest-talk");
  const [e1, e2] = noErr(a); ok("GUEST: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("SCHED", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "schedule", 2600);
  ok("SCHED: график руководителя открылся", !!(await until(() => a.page.locator("[data-sched-tabs]").count(), 9000)));
  await sleep(600);
  const tabs = await st(a.page, "[data-sched-tabs]"), tab = await st(a.page, '[data-sched-tabs] [data-lens-btn="tab"]');
  ok("SCHED: «График / Настройки» — капсула с ободком и кольцом, выбранная — плашка с золотым ободком", !!tabs && tabs.ring === RING && tabs.sh.includes(RIM) && isTab(tab), JSON.stringify([tabs, tab]));
  const wm = await st(a.page, "[data-sched-weekmode]"), wb = await st(a.page, '[data-sched-weekmode] [data-lens-btn="tab"]');
  ok("SCHED: «неделя / месяц» — капсула без кольца, выбранная — плашка", !!wm && !wm.ring && wm.sh.includes(RIM) && isTab(wb), JSON.stringify([wm, wb]));
  const fill = await st(a.page, await pick(a.page, "button", "Заполнить черновик"));
  ok("SCHED: «Заполнить черновик» — плашка с кольцом", isMain(fill), JSON.stringify(fill));
  const ne = await a.page.locator("[data-lens-edge]").count(), e = await st(a.page, "[data-lens-edge]");
  ok("SCHED: карточки — золотая кромка и блик, без света сверху", ne >= 3 && isEdge(e), ne + " " + JSON.stringify(e));
  const discs = await a.page.evaluate(() => [...document.querySelectorAll('.sa-schedwrap [data-lens="disc"]')].filter((d) => d.offsetParent !== null).map((d) => {
    const s = getComputedStyle(d), r = getComputedStyle(d, "::after"); return s.backgroundColor + "|" + r.borderTopColor; }));
  ok("SCHED: стрелки и раскрытие «Сегодня» — линзы с кольцом", discs.length >= 1 && discs.every((t) => t === GLASS + "|" + RING), discs.join(" · "));
  const sec = await st(a.page, ".sa-schedsec");
  ok("SCHED: разделы («Отработано по людям» …) — кромка", !!sec && sec.bc === EDGE && sec.sh.includes(HL), JSON.stringify(sec));
  await shot(a.page, "sched");
  await a.page.locator("[data-sched-tabs] button").nth(1).click(); await sleep(1300);
  const no = await st(a.page, ".sa-schedno"), fld = await st(a.page, ".sa-schedwrap input[data-lens-field]");
  ok("SCHED: «Настройки»: номера шагов — линзы с кольцом, поля часов — стекло", !!no && no.bg === GLASS && no.ring === RING && !!fld && fld.bg === GLASS, JSON.stringify([no, fld]));
  await shot(a.page, "sched-setup");
  const [e1, e2] = noErr(a); ok("SCHED: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("STAFF", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "schedule", 2600);
  ok("STAFF: график сотрудника открылся", !!(await until(() => a.page.locator("[data-sched-hero]").count(), 9000)));
  await sleep(600);
  const hero = await st(a.page, "[data-sched-hero]"), med = await st(a.page, "[data-sched-medals] > div");
  ok("STAFF: карточка смены — кромка; итоги месяца — кромка и свой градиент (не стёрт)", isEdge(hero) && !!med && med.bc === EDGE && /linear-gradient/.test(med.img), JSON.stringify([hero, med]));
  const ch = await st(a.page, "[data-hero-checklist]"), mt = await st(a.page, "[data-hero-mates]");
  ok("STAFF: «Чек-лист смены» (в день смены) — плашка с кольцом, «Кто со мной» — стекло", (!ch || isMain(ch)) && isSoft(mt), JSON.stringify([ch, mt]));
  const vt = await st(a.page, '[data-sched-viewtoggle] [data-lens-btn="tab"]'), vtw = await st(a.page, "[data-sched-viewtoggle]");
  ok("STAFF: «месяц / списком» — капсула без кольца, выбранная — плашка", isTab(vt) && !!vtw && !vtw.ring, JSON.stringify([vt, vtw]));
  const per = await pick(a.page, "button", "Отметить период"), p0 = await st(a.page, per);
  ok("STAFF: «Отметить период» — стекло", isSoft(p0), JSON.stringify(p0));
  if (p0) { await a.page.locator(per).click(); await sleep(500); }
  const p1 = await st(a.page, await pick(a.page, "button", "Отмена периода"));
  ok("STAFF: идёт отметка периода — ободок ярче", !!p1 && p1.sh.includes("rgb(232, 201, 131) 0px 0px 0px 1px inset"), JSON.stringify(p1));
  await shot(a.page, "staff");
  const [e1, e2] = noErr(a); ok("STAFF: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("TEAM", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv });
  await nav(a.page, "team", 2400);
  ok("TEAM: «Команда» — список людей", !!(await until(async () => (await a.page.locator("div.sa-btn[data-lens-card]").count()) >= 8, 9000)));
  const row = await st(a.page, "div.sa-btn[data-lens-card]");
  ok("TEAM: человек — карточка линзы", lensCard(row) && row.sh.includes(HL), JSON.stringify(row));
  ok("TEAM: у владельца должность словами — «Владелец», а не owner", (await a.page.locator("text=/Владелец · /").count()) >= 1 && !(await a.page.locator("text=/owner · /").count()));
  const add = await st(a.page, await pick(a.page, "button", "+ Добавить"));
  ok("TEAM: «+ Добавить» — плашка с кольцом", isMain(add), JSON.stringify(add));
  const nt = await a.page.locator("[data-lens-edge]").count(), tile = await st(a.page, "[data-lens-edge]");
  ok("TEAM: итоги («активных», «ждут код», «спят») — кромка без света", nt === 3 && isEdge(tile), nt + " " + JSON.stringify(tile));
  const s = await st(a.page, 'input[placeholder^="Поиск по имени"]');
  ok("TEAM: поиск — стекло с ободком", !!s && s.bg === GLASS && s.sh.includes(RIM), JSON.stringify(s));
  await shot(a.page, "team");
  await a.page.getByText("Анна Смирнова").first().click(); await sleep(1000);
  const av = await st(a.page, '[data-lens="avatar"]'), reset = await st(a.page, await pick(a.page, "button", "Сбросить код")), ed = await st(a.page, await pick(a.page, "button", "Изменить имя"));
  ok("TEAM: сотрудник — аватар с кольцом, «Сбросить код» — плашка, «Изменить имя» — стекло", !!av && av.ring === RING && isMain(reset) && isSoft(ed), JSON.stringify([av, reset, ed]));
  const del = await st(a.page, await pick(a.page, "button", "Удалить из команды"));
  ok("TEAM: «Удалить из команды» — прежний красный, только капсулой", !!del && del.rad === "999px" && del.color === RED && !del.ring && !/radial-gradient/.test(del.img), JSON.stringify(del));
  await shot(a.page, "team-card");
  const [e1, e2] = noErr(a); ok("TEAM: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("HR", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv });
  await nav(a.page, "candidate", 2400);
  await until(() => a.page.locator("[data-hr-row]").count(), 9000);
  const go = await st(a.page, await pick(a.page, "button", "Начать собеседование")), row = await st(a.page, "[data-hr-row]");
  ok("HR: «Начать собеседование» — плашка с кольцом, строка AI HR — карточка линзы", isMain(go) && lensCard(row), JSON.stringify([go, row]));
  await a.page.locator("[data-hr-row]").click(); await sleep(1500);
  await until(() => a.page.locator("[data-hr-status]").count(), 9000);
  const stt = await st(a.page, "[data-hr-status]"), run1 = await st(a.page, "[data-hr-eval-start]");
  ok("HR: «Проверка AI HR» — карточки линзы, «Запустить проверку» — плашка с кольцом", lensCard(stt) && isMain(run1), JSON.stringify([stt, run1]));
  await shot(a.page, "hr-eval");
  await a.page.locator('[aria-label="Вернуться"]').first().click(); await sleep(900);
  await a.page.locator(await pick(a.page, "button", "Начать собеседование")).click(); await sleep(900);
  const nm = await st(a.page, 'input[placeholder="Имя кандидата"]');
  const roles = await a.page.evaluate(() => [...document.querySelectorAll("[data-lens-card]")].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute("data-lens-card") + "|" + getComputedStyle(e).borderTopColor));
  ok("HR: поле имени — стекло; выбранная роль — яркий ободок, остальные — кромка", !!nm && nm.bg === GLASS && roles.filter((r) => r === "hi|" + HI).length === 1 && roles.filter((r) => r === "|" + EDGE).length >= 3, JSON.stringify([nm, roles]));
  await shot(a.page, "hr-setup");
  const [e1, e2] = noErr(a); ok("HR: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("GLOSS", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "glossary", 2000);
  await until(() => a.page.locator('input[placeholder="Поиск термина..."]').count(), 9000); await sleep(400);
  const s = await st(a.page, 'input[placeholder="Поиск термина..."]'), card = await st(a.page, '[data-lens-card]');
  ok("GLOSS: поиск — стекло, термины — карточки линзы", !!s && s.bg === GLASS && lensCard(card), JSON.stringify([s, card]));
  const fav0 = await st(a.page, "button[aria-pressed]");
  ok("GLOSS: «Только избранное» — стекло", isSoft(fav0), JSON.stringify(fav0));
  await a.page.locator("button[aria-pressed]").click(); await sleep(500);
  const fav1 = await st(a.page, "button[aria-pressed]");
  ok("GLOSS: «Только избранное» включено — плашка с золотым ободком", isTab(fav1), JSON.stringify(fav1));
  await a.page.locator("button[aria-pressed]").click(); await sleep(400);
  const star = await st(a.page, 'button[aria-label="В избранное"]');
  ok("GLOSS: звёздочка — прежняя (без стекла и кольца)", !!star && star.bg === "rgba(0, 0, 0, 0)" && !star.ring, JSON.stringify(star));
  await shot(a.page, "gloss");
  const [e1, e2] = noErr(a); ok("GLOSS: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("MENTOR", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "assistant", 2000);
  await until(() => a.page.locator('[aria-label="Список чатов"]').count(), 9000); await sleep(500);
  const l = await st(a.page, '[aria-label="Список чатов"]'), nw = await st(a.page, '[aria-label="Новый чат"]'), ai = await st(a.page, '.sa-pop[data-lens="disc"]');
  ok("MENTOR: кнопки шапки и значок AI — линзы с кольцом", isDisc(l) && isDisc(nw) && isDisc(ai), JSON.stringify([l, nw, ai]));
  const q = await st(a.page, "button.sa-pagein[data-lens-card]"), intro = await st(a.page, "div.sa-pagein[data-lens-card]");
  ok("MENTOR: вступление и готовые вопросы — карточки линзы", lensCard(q) && lensCard(intro), JSON.stringify([q, intro]));
  const bar = await st(a.page, ".sa-ai-bar [data-lens-field]");
  ok("MENTOR: строка ввода — стекло с ободком", !!bar && bar.bg === GLASS && bar.sh.includes(RIM), JSON.stringify(bar));
  await a.page.locator(".sa-ai-bar textarea").focus(); await sleep(300);
  const bar2 = await st(a.page, ".sa-ai-bar [data-lens-field]");
  ok("MENTOR: пока пишешь — ободок ярче", !!bar2 && bar2.sh.includes("rgb(232, 201, 131) 0px 0px 0px 1px inset"), JSON.stringify(bar2));
  await a.page.locator(".sa-ai-bar textarea").blur(); await sleep(200);
  const mic = await st(a.page, '.sa-ai-bar [data-lens="mic"]'), talk = await st(a.page, ".sa-ai-bar [data-talk-open]");
  ok("MENTOR: микрофон — кольцо; «Разговор голосом» — золотая линза с кольцом (если есть голос)", !!mic && mic.ring === RING
    && (!talk || (/radial-gradient/.test(talk.img) && talk.color === HI && talk.ring === RING)), JSON.stringify([mic, talk]));
  await shot(a.page, "mentor");
  const [e1, e2] = noErr(a); ok("MENTOR: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const G_L = "rgba(139, 106, 48, 0.09)", E_L = "rgba(139, 106, 48, 0.3)", HI_L = "rgb(138, 101, 36)";
  const a = await open({ who: ROMAN, srv, light: true });
  await nav(a.page, "team", 2400);
  await until(async () => (await a.page.locator("div.sa-btn[data-lens-card]").count()) >= 8, 9000);
  const add = await st(a.page, await pick(a.page, "button", "+ Добавить")), row = await st(a.page, "div.sa-btn[data-lens-card]"), s = await st(a.page, 'input[placeholder^="Поиск по имени"]');
  ok("PAPER: «Команда» — плашка светлым стеклом с тёмным золотом, кромка и поиск — тёмным золотом", !!add && add.img.includes("rgba(255, 255, 255, 0.85)") && add.color === HI_L && add.ring === "rgba(139, 106, 48, 0.45)"
    && !!row && row.bc === E_L && !!s && s.bg === G_L, JSON.stringify([add, row, s]));
  await shot(a.page, "paper-team");
  const b = await open({ who: MARIA, srv, light: true });
  await nav(b.page, "schedule", 2600); await until(() => b.page.locator("[data-sched-tabs]").count(), 9000); await sleep(500);
  const tab = await st(b.page, '[data-sched-tabs] [data-lens-btn="tab"]'), e = await st(b.page, "[data-lens-edge]");
  // выбранная вкладка в «Для чтения» — #6B4E1A (с #8A6524 на светлой плашке было 4,1 при норме 4,5)
  ok("PAPER: график — выбранная вкладка тёмным золотом #6B4E1A, кромка тёмным золотом", !!tab && tab.color === "rgb(107, 78, 26)" && tab.img.includes("rgba(255, 255, 255, 0.9)") && !!e && e.bc === E_L, JSON.stringify([tab, e]));
  await shot(b.page, "paper-sched");
  const [e1, e2] = noErr(a, b); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf();
  const a = await open({ who: ROMAN, srv, seedExtra: { sa_home_look: "now" } });
  ok("NOW: вид «как сейчас» — без класса линзы", !(await a.page.evaluate(() => document.documentElement.classList.contains("sa-lens"))));
  await nav(a.page, "team", 2400);
  await until(async () => (await a.page.locator("div.sa-btn[data-lens-card]").count()) >= 8, 9000);
  const add = await st(a.page, await pick(a.page, "button", "+ Добавить")), row = await st(a.page, "div.sa-btn[data-lens-card]"), del0 = row;
  ok("NOW: «Команда» — «+ Добавить» прежним золотом без кольца, карточки без кромки линзы", !!add && /linear-gradient/.test(add.img) && !add.ring && add.color === "rgb(255, 255, 255)" && !!del0 && del0.bc !== EDGE, JSON.stringify([add, row]));
  await a.page.getByText("Анна Смирнова").first().click(); await sleep(900);
  const del = await st(a.page, await pick(a.page, "button", "Удалить из команды"));
  ok("NOW: «Удалить из команды» — прежняя форма (не капсула)", !!del && del.rad !== "999px" && del.color === RED, JSON.stringify(del));
  const b = await open({ who: MARIA, srv, seedExtra: { sa_home_look: "now" } });
  await nav(b.page, "schedule", 2600); await until(() => b.page.locator("[data-sched-tabs]").count(), 9000); await sleep(500);
  const tabs = await st(b.page, "[data-sched-tabs]"), e = await st(b.page, "[data-lens-edge]");
  ok("NOW: график — вкладки без кольца, карточки без кромки линзы", !!tabs && !tabs.ring && !!e && e.bc !== EDGE, JSON.stringify([tabs, e]));
  await nav(b.page, "assistant", 2000); await sleep(500);
  const l = await st(b.page, '[aria-label="Список чатов"]'), bar = await st(b.page, ".sa-ai-bar [data-lens-field]");
  ok("NOW: Наставник — кнопки шапки без кольца, строка ввода прежняя", !!l && !l.ring && !!bar && bar.bg !== GLASS, JSON.stringify([l, bar]));
  const [e1, e2] = noErr(a, b); ok("NOW: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("LIGHT", async () => {
  const srv = srvOf();
  const bad = []; let seen = 0;
  const add = (th, what, x) => { seen += x.n; bad.push(...x.out.map((o) => th + " " + what + ": " + o)); };
  for (const light of [false, true]) {
    const th = light ? "светлая" : "тёмная";
    const r = await open({ who: ROMAN, srv, light });
    await nav(r.page, "team", 2400); await until(async () => (await r.page.locator("div.sa-btn[data-lens-card]").count()) >= 8, 9000);
    add(th, "команда", await lightAudit(r.page));
    await nav(r.page, "candidate", 2200); await until(() => r.page.locator("[data-hr-row]").count(), 9000);
    add(th, "собеседование", await lightAudit(r.page));
    await r.ctx.close();
    const m = await open({ who: MARIA, srv, light });
    await nav(m.page, "glossary", 2000); await sleep(500);
    add(th, "глоссарий", await lightAudit(m.page));
    await nav(m.page, "assistant", 2000); await sleep(600);
    add(th, "наставник", await lightAudit(m.page));
    await nav(m.page, "brief", 2200); await until(() => m.page.locator("[data-brief-block]").count(), 9000);
    add(th, "брифинг", await lightAudit(m.page));
    await nav(m.page, "cases", 2200); await sleep(600);
    add(th, "случаи", await lightAudit(m.page));
    await m.ctx.close();
  }
  ok("LIGHT: подписи в карточках измерены (обе темы, шесть экранов)", seen >= 60, "надписей: " + seen);
  ok("LIGHT: свет карточек не опускает подписи ниже нормы (где без света она была)", !bad.length, bad.slice(0, 8).join(" || "));
});

await run("CONTRAST", async () => {
  const srv = srvOf();
  const res = [];
  const m = await open({ who: MARIA, srv, light: true });
  await nav(m.page, "schedule", 2600); await until(() => m.page.locator("[data-sched-tabs]").count(), 9000); await sleep(700);
  res.push(["светлая: выбранная вкладка «График»", await pxRatio(m.page, '[data-sched-tabs] [data-lens-btn="tab"]')]);
  res.push(["светлая: «неделя»", await pxRatio(m.page, '[data-sched-weekmode] [data-lens-btn="tab"]')]);
  const d = await open({ who: MARIA, srv });
  await nav(d.page, "schedule", 2600); await until(() => d.page.locator("[data-sched-more]").count(), 9000); await sleep(700);
  res.push(["тёмная: «Ещё»", await pxRatio(d.page, "[data-sched-more]")]);
  const r = await open({ who: ROMAN, srv, light: true });
  await nav(r.page, "team", 2400); await until(async () => (await r.page.locator("div.sa-btn[data-lens-card]").count()) >= 8, 9000);
  await r.page.getByText("Анна Смирнова").first().click(); await sleep(900);
  res.push(["светлая: «Изменить имя и фамилию»", await pxRatio(r.page, await pick(r.page, "button", "Изменить имя"))]);
  const a = await open({ who: ANNA, srv, light: true });
  await nav(a.page, "schedule", 2600); await until(() => a.page.locator("[data-sched-viewtoggle]").count(), 9000); await sleep(700);
  res.push(["светлая: «месяц»", await pxRatio(a.page, '[data-sched-viewtoggle] [data-lens-btn="tab"]')]);
  ok("CONTRAST: вкладки и стекло в «Для чтения», «Ещё» в тёмной — не ниже нормы (по пикселям)", res.every(([, x]) => x && x.r >= x.need), JSON.stringify(res));
  await m.ctx.close(); await d.ctx.close(); await r.ctx.close(); await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, w: 320, h: 700 });
  await nav(a.page, "schedule", 2600); await until(() => a.page.locator("[data-sched-tabs]").count(), 9000); await sleep(500);
  let f = await a.page.evaluate(() => ({ W: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  let out = await ringIn(a.page, '[data-sched-tabs],[data-lens-btn="main"],.sa-schedwrap [data-lens="disc"]');
  ok("NARROW: 320 px — график без сдвига вбок, кольца в экране", f.sw <= f.W && !out.length, JSON.stringify([f, out]));
  await nav(a.page, "assistant", 2000); await sleep(500);
  f = await a.page.evaluate(() => ({ W: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  out = await ringIn(a.page, '[data-lens="disc"],[data-talk-open],[data-lens="mic"]');
  ok("NARROW: 320 px — Наставник без сдвига вбок, кольца в экране", f.sw <= f.W && !out.length, JSON.stringify([f, out]));
  await shot(a.page, "narrow-mentor");
  const r = await open({ who: ROMAN, srv, w: 320, h: 700 });
  await nav(r.page, "team", 2400); await until(async () => (await r.page.locator("div.sa-btn[data-lens-card]").count()) >= 8, 9000);
  f = await r.page.evaluate(() => ({ W: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  out = await ringIn(r.page, '[data-lens-btn="main"]');
  ok("NARROW: 320 px — «Команда» без сдвига вбок, кольцо «+ Добавить» в экране", f.sw <= f.W && !out.length, JSON.stringify([f, out]));
  await a.ctx.close(); await r.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
