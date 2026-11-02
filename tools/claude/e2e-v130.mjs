// e2e v130 (Доп. 443): «Барная карта» — печать, как у меню, и «Поделиться в чат». Владелец (02.11): «Давай в барную карту
// добавим возможность распечатать информацию. Имею ввиду, как в меню» — на восемь предложений «Да, давай все», и «нужна ещё
// функция «поделиться в чат». В колоде коктейлей вроде и есть. А вот вина и крепкие не имеют такой возможности».
// Сервер — fake-server.js (с этапом 46; noStage46 — без него); карты — e2e-v127 (вина, крепкое, свой коктейль). Разделы:
//   ENTRY  — «Печать» со значком принтера в строке под вкладками (коктейли, вина, крепкое); экран «Барная карта для печати»:
//            «Коктейли · Вина · Крепкое · Вся карта» со счётом, выбрана вкладка, откуда пришёл; был поиск, раздел или основа —
//            «Только показанные: …, N» и «Все N»; «назад» — та же вкладка, тот же поиск и место;
//   SHEET  — лист на холсте: страница 1520 × 2148 (А4), шапка, подвал, разделы как в карте, у вина и крепкого то же, что в
//            карточке («Не проверено: …», стопа на бумаге нет, архива нет), фото бутылки и «Без фото», коктейли — состав,
//            «Как готовить», «Из нашей карты», «свой»; листать страницы; «Вся карта» — номера сквозные;
//   SEND   — «Текстом» в буфер; «Отправить страницу» и «Все N» — файлы; «Печать» — те же страницы по одной на А4 (PDF
//            без лишних страниц), на экране их нет; в Telegram «Печати» нет и сказано, что делать;
//   SHARE  — «Поделиться в чат» в карточке вина, крепкого и коктейля: лист, карточка «Вино: Шабли 2022» с фото бутылки,
//            «Открыть в Барной карте» (и когда карта уже на экране); без этапа 46 — сказано словами;
//   ASSIST — Наставник знает «Барную карту»: что ушло в ai-chat, карточка вина (и с фото) и крепкого под ответом, касание;
//   LENS, PAPER, NARROW — вид.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v130.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5330, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v130";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
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
function srvOf(menu = MENU, extra = {}) {   // v130: extra — например { noStage46: true }
  const pings = [];
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu,
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s0-p", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"] }, quizzes: { "e-anna": ["s0-q"] },
    tgLinked: ["u-maria", "e-anna", "e-ksenia", "e-petr"], newbies: NEWBIES, nbMemo: MEMO, cands: CANDS, cheers: false,
    activity: ACTIVITY, quiz: QUIZ, thanks: THANKS, peerThanks: PEER, learn: { "e-anna": [-1, -2], "u-maria": [-1], "e-petr": [-12] },
    ping: (to, text) => pings.push({ to, text }), ...extra });
  s.calls = []; s.pings = pings;
  s.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут.");
  for (const k of Object.keys(s.S.seen)) delete s.S.seen[k];
  return s;
}

// v130: имена файлов по-русски («Барная_карта_…png») — браузеру нужна UTF-8-локаль (без неё он называет файл «download»)
const browser = await chromium.launch({ env: { ...process.env, LANG: "C.UTF-8" } });
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = MARIA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, mobile = true, path = "/", seedExtra = {}, fold = false, hints = true, menu = MENU, init = null, downloads = false } = {}) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce", acceptDownloads: downloads });
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
  if (init) await ctx.addInitScript(init);   // v130: следить за холстом, буфером, печатью и «Telegram»
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
// v127 (Доп. 440): «Наша винная карта» теперь — вкладка «Вина» в «Барной карте» (Справочник → «Барная карта» → «Вина»)
const openBarWines = async (page) => { const okk = await clickText(page, ".sa-card, [data-ref-card]", "Барная карта"); if (!okk) return false; for (let i = 0; i < 30; i++) { if (await page.locator('[data-bar-tab="wine"], [data-wine-list]').count()) break; await sleep(200); }
  await page.evaluate(() => { const b = document.querySelector('[data-bar-tab="wine"]'); if (b && b.getAttribute("aria-pressed") !== "true") b.click(); }); await sleep(400); return true; };
const toList = async (page) => { await go(page, "reference", 1800); return openBarWines(page); };


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

// ── v125: «Кто выучил новые вина» (этап 44; сервер — fake-server.js, как supabase-stage44-wines.sql: pg-check-stage44) ──
const W_KEY = R0 + "|";
const prog = (srv, id) => srv.S.wine[W_KEY + id] || null;
const sets = (srv, kind) => srv.calls.filter((c) => c.fn === "wine_progress_set" && (!kind || c.body.p_kind === kind));
const back = async (page) => { await page.locator('[data-lens="back"]').first().click(); await sleep(700); };
// под нагрузкой (два прогона на двух ядрах) справочник открывается дольше: ждём «Барная карта», вкладку «Вина» и «Учить вина»,
// при надобности открываем карту ещё раз; пункт тренировки — тоже дождаться
const toHubW = async (page) => {
  for (let i = 0; i < 3; i++) {
    await go(page, "reference", 1200);
    await until(() => openBarWines(page), 9000, 400);
    if (await until(() => page.locator("[data-wine-train-open]").count(), 9000)) break;
  }
  await page.locator("[data-wine-train-open]").click(); await sleep(700);
  await until(() => page.locator("[data-wine-train]").count(), 9000);
};
const hubOpenW = async (page, key) => { await until(() => page.locator(`[data-wine-train="${key}"]`).count(), 9000); await hubOpen(page, key); };
const teamOf = (page) => page.evaluate(() => ({ rows: [...document.querySelectorAll("[data-wine-team-row]")].map((e) => ({ id: e.getAttribute("data-wine-team-row"), state: e.getAttribute("data-wine-team-state"),
  status: (e.querySelector("[data-wine-team-status]") || {}).textContent || "", prog: (e.querySelector("[data-wine-team-prog]") || {}).textContent || "" })),
  line: (document.querySelector("[data-wine-team-line]") || {}).textContent || "", head: (document.querySelector("[data-wine-team-sum]") || {}).textContent || "",
  msg: (document.querySelector("[data-wine-team-msg]") || { getAttribute: () => null }).getAttribute("data-wine-team-msg"), msgT: (document.querySelector("[data-wine-team-msg]") || {}).textContent || "" }));

// ── v127: «Барная карта» — коктейли, вина и крепкое (ui/bar-card.jsx); крепкое — тот же экран, что у вин, с видом K ──
const { normSpirit } = await import(SRC + "/lib/spirit.js");
// крепкое: семь позиций в карте (одна — с полями от AI, не проверена) и одна в архиве; «Maker's Mark» и «Havana Club 7» —
// добавлены на днях (новинки); «ходовое» — Glenfiddich, Maker's Mark, Beefeater
const SPIRITS = [
  normSpirit({ name: "Glenfiddich 12", producer: "William Grant & Sons", cat: "whisky", style: "односолодовый", country: "Шотландия", region: "Спейсайд", age: "12 лет", abv: 40, portion: 40, pricePortion: 650,
    priceBottle: 9800, volume: "0,7 л", serve: ["чистым", "с каплей воды"], glass: "гленкерн", hot: true, notes: ["груша", "мёд", "дуб"], short: "Мягкий спейсайд с грушей и мёдом.", pair: [dishId("Крабовая котлета")] }, { id: "sp-gle" }),
  normSpirit({ name: "Maker's Mark", cat: "whisky", style: "бурбон", country: "США", region: "Кентукки", abv: 45, portion: 40, pricePortion: 550, priceBottle: 7900, serve: ["чистым", "со льдом", "в коктейле"],
    glass: "рокс", hot: true, notes: ["карамель", "ваниль"], short: "Сладкий бурбон: чистым, со льдом или в «Олд фэшн».", addedAt: PNOW - 2 * DAY }, { id: "sp-mak" }),
  normSpirit({ name: "Hennessy VS", cat: "cognac", style: "VS", country: "Франция", region: "Коньяк", abv: 40, portion: 40, pricePortion: 750, serve: ["чистым"], glass: "тюльпан", notes: ["ваниль", "дуб"],
    short: "Ваниль и дуб, после ужина.", pair: [dishId("Ассорти конфет")] }, { id: "sp-hen" }),
  normSpirit({ name: "Havana Club 7", cat: "rum", style: "выдержанный", country: "Куба", age: "7 лет", abv: 40, portion: 50, pricePortion: 450, serve: ["чистым", "со льдом"], glass: "рокс",
    notes: ["какао", "табак"], short: "Какао и табак: чистым или со льдом.", addedAt: PNOW - 3 * DAY }, { id: "sp-hav" }),
  normSpirit({ name: "Beefeater", cat: "gin", style: "London Dry", country: "Великобритания", abv: 40, portion: 40, pricePortion: 380, serve: ["в коктейле"], glass: "хайбол", hot: true,
    notes: ["можжевельник", "цитрус"], short: "Можжевельник и цитрус: в джин-тоник.", pair: [dishId("Креветка темпура")] }, { id: "sp-bee" }),
  normSpirit({ name: "Campari", cat: "bitter", style: "аперитив", country: "Италия", abv: 25, portion: 40, pricePortion: 400, serve: ["со льдом", "в коктейле"], glass: "рокс",
    notes: ["горький апельсин"], short: "Горький апельсин: в «Негрони» или со льдом." }, { id: "sp-cam" }),
  normSpirit({ name: "Olmeca Blanco", cat: "agave", style: "бланко", country: "Мексика", abv: 38, notes: ["агава", "цитрус"], short: "Свежая бланко." }, { id: "sp-olm", ai: ["notes", "short"] }),
  normSpirit({ name: "Старый ром", cat: "rum", archived: true }, { id: "sp-old" }),
];
// свой коктейль бара (запись kind:"cocktail") — в колоде он первый
const HOUSE = { id: "ck-sea", kind: "cocktail", name: "Морской бриз по-нашему", base: "Водка", glass: "highball", method: "билд", ing: [["Водка", 40, "мл"], ["Клюквенный морс", 90, "мл"]], steps: ["Лёд в хайбол", "Водка и морс"] };
const MENU_B = [...JSON.parse(JSON.stringify(MENU)), HOUSE, ...T_WINES, ...SPIRITS];
const MENU_SP = [...JSON.parse(JSON.stringify(MENU)), ...SPIRITS];   // без вин: вкладки «Коктейли · Крепкое»
const S_KEY = R0 + "|";
const progS = (srv, id) => srv.S.spirit[S_KEY + id] || null;
const setsS = (srv, kind) => srv.calls.filter((c) => c.fn === "spirit_progress_set" && (!kind || c.body.p_kind === kind));
const spirits = (srv) => (srv.S.menu || []).filter((d) => d && d.kind === "spirit");
const SSRK = "sa_spirit_sr_" + R0, SLRK = "sa_spirit_learned_" + R0;
const nb = (t) => String(t || "").replace(/ /g, " ");
// «Барная карта» из Справочника и нужная вкладка; под нагрузкой — ещё раз
const openBar = async (page, tab = null) => {
  for (let i = 0; i < 3; i++) {
    await go(page, "reference", 1200);
    await until(() => clickText(page, ".sa-card, [data-ref-card]", "Барная карта"), 9000, 400);
    if (!(await until(() => page.locator("[data-bar-cocktails], [data-wine-list], [data-drink-kind]").count(), 9000))) continue;
    if (!tab) return true;
    await page.evaluate((t) => { const b = document.querySelector(`[data-bar-tab="${t}"]`); if (b && b.getAttribute("aria-selected") !== "true") b.click(); }, tab); await sleep(500);
    if (tab === "cocktail" ? await page.locator("[data-bar-cocktails]").count() : await page.locator(`[data-drink-kind="${tab}"]`).count()) return true;
  }
  return false;
};
const toHubS = async (page) => {
  await openBar(page, "spirit");
  await until(() => page.locator("[data-wine-train-open]").count(), 9000);
  await page.locator("[data-wine-train-open]").click(); await sleep(700);
  await until(() => page.locator("[data-wine-train]").count(), 9000);
};
const tabsOf = (page) => page.evaluate(() => ({ tabs: (document.querySelector("[data-bar-tabs]") || { getAttribute: () => "" }).getAttribute("data-bar-tabs"),
  on: (document.querySelector('[data-bar-tab][aria-selected="true"]') || { getAttribute: () => "" }).getAttribute("data-bar-tab"),
  kind: (document.querySelector("[data-drink-kind]") || { getAttribute: () => "" }).getAttribute("data-drink-kind"), ck: !!document.querySelector("[data-bar-cocktails]") }));
const deckFront = (page) => page.evaluate(() => { const f = [...document.querySelectorAll(".sa-ck-front")].find((x) => x.offsetParent !== null); return f ? f.innerText.replace(/\s+/g, " ").trim() : ""; });
const SP_GUESS = (name) => ({ name, producer: "Дом " + name.split(" ")[0], cat: "whisky", style: "купажированный", country: "Ирландия", abv: 40, serve: ["чистым", "со льдом"], glass: "рокс",
  notes: ["ваниль", "мёд"], short: "Мягкий и сладковатый: со льдом или чистым.", story: "" });
const SP_ANSWER = (b) => (b.mode === "fill" ? { wines: [SP_GUESS(b.name)] } : b.mode === "names" ? { wines: b.names.map(SP_GUESS) } : { wines: [SP_GUESS("Talisker 10")] });

// ── v128: «Барная карта» удобнее, проще, красивее ──
// большая карта: 30 вин по четырём цветам; 20 — с нотами от AI (не проверены), 10 — проверены; каждое третье — «Русское /
// Original», каждое пятое — регион совпал со страной («Австрия, Австрия»); сладость и цены — разные
const SWEETS = ["брют", "сухое", "полусухое", "полусладкое", "сладкое"];
const BIG = Array.from({ length: 30 }, (_, i) => normWine({
  name: i % 3 === 0 ? `Вино ${i + 1} / Wine ${i + 1} Reserve` : `Вино номер ${i + 1}`,
  country: i % 5 === 0 ? "Австрия" : "Италия", region: i % 5 === 0 ? "Австрия" : "Тоскана",
  color: ["sparkling", "white", "rose", "red"][i % 4], sweet: SWEETS[i % 5], grapes: ["санджовезе"], notes: ["вишня"],
  priceBottle: 2000 + i * 500, byGlass: i % 4 === 1, priceGlass: i % 4 === 1 ? 400 + i * 20 : "",
}, { id: "w-b" + (i + 1), ai: i < 20 ? ["notes"] : [] }));
const MENU_BIG = [...JSON.parse(JSON.stringify(MENU)), ...BIG, ...SPIRITS];
const bigWines = (srv) => (srv.S.menu || []).filter((d) => d && d.kind === "wine");
const rowIds = (page) => page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((e) => e.getAttribute("data-wine-row")));
const pinState = (page) => page.evaluate(() => { const p = document.querySelector("[data-bar-pin]"); if (!p) return null; const r = p.getBoundingClientRect();
  return { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), tabs: [...p.querySelectorAll("[data-bar-pin-tab]")].map((b) => b.getAttribute("data-bar-pin-tab")).join(","),
    chips: [...p.querySelectorAll("[data-wine-pin-only], [data-bar-pin-ck]")].map((b) => b.textContent.trim()).join("|"), bg: getComputedStyle(p).backgroundColor,
    W: document.documentElement.clientWidth }; });
const scrollBy = (page, y) => page.evaluate((y) => { const r = document.getElementById("root"); r.scrollTop = y; return r.scrollTop; }, y);

// ── v128, затем: проще, без лишних касаний ──
const ckCard = (page) => page.evaluate(() => { const c = document.querySelector("[data-bar-ck-card]"); if (!c) return null; const t = (sel) => [...c.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  return { id: c.getAttribute("data-bar-ck-card"), title: (c.querySelector('[data-lens="back"] + div') || {}).textContent || "", ing: t("[data-bar-ck-ing] > div"), how: t("[data-bar-ck-how] li"), ours: [...c.querySelectorAll("[data-bar-ck-spirit]")].map((e) => e.getAttribute("data-bar-ck-spirit")),
    text: c.innerText.replace(/\s+/g, " "), learn: !!c.querySelector("[data-bar-ck-learn]"), build: !!c.querySelector("[data-bar-ck-build]"), edit: !!c.querySelector('[data-bar-ck-edit="card"]'), art: !!c.querySelector('[data-bar-ck-art="big"] svg'),
    steps: (c.querySelector("[data-card-steps]") || { getAttribute: () => "" }).getAttribute("data-card-steps"), top: document.getElementById("root").scrollTop }; });
const stepsAt = (page) => page.evaluate(() => ({ at: (document.querySelector("[data-card-steps]") || { getAttribute: () => "" }).getAttribute("data-card-steps"),
  prev: ((document.querySelector('[data-card-step="prev"]') || {}).textContent || "").replace(/\s+/g, " ").trim(), next: ((document.querySelector('[data-card-step="next"]') || {}).textContent || "").replace(/\s+/g, " ").trim(),
  card: (document.querySelector("[data-wine-card]") || document.querySelector("[data-bar-ck-card]") || { getAttribute: () => "" }).getAttribute(document.querySelector("[data-wine-card]") ? "data-wine-card" : "data-bar-ck-card") }));
const stepGo = async (page, dir) => { await page.locator(`[data-card-step="${dir}"]`).click(); await sleep(450); };
// строка списка целиком в поле зрения (не под копией шапки сверху и не под нижним меню)
const inView = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 100 && r.bottom <= window.innerHeight - 60; }, sel);
const ckIds = (page) => page.evaluate(() => [...document.querySelectorAll("[data-bar-ck]")].map((e) => e.getAttribute("data-bar-ck")));

const toTopPage = (page) => page.evaluate(() => { document.getElementById('root').scrollTop = 0; });

// ── v129 ──
const kicker = (page) => page.evaluate(() => { const b = document.querySelector('[data-lens="back"]'); const k = b && b.nextElementSibling && b.nextElementSibling.firstElementChild; return k ? k.textContent.trim() : ""; });
const listFilter = (page, list = "[data-wine-list]") => page.evaluate((list) => { const f = document.querySelector(list + " [data-bar-filter]"); return f ? (f.querySelector("span").textContent + " · " + f.querySelector("button").textContent).replace(/\s+/g, " ").trim() : ""; }, list);
const pinOf = (page) => page.evaluate(() => { const p = document.querySelector("[data-bar-pin]"); if (!p) return null; const row = p.querySelector(".sa-hscroll"), act = row && row.querySelector('[aria-pressed="true"]');
  const r = row ? row.getBoundingClientRect() : null, a = act ? act.getBoundingClientRect() : null;
  return { act: act ? act.getAttribute("data-wine-pin-only") || act.getAttribute("data-bar-pin-ck") : "", inView: !!(a && r) && a.left >= r.left - 1 && a.right <= r.right + 1,
    line: (() => { const l = p.querySelector("[data-bar-pin-line]"); if (!l) return ""; const f = l.querySelector("[data-bar-filter]"); return (f ? f.querySelector("span").textContent + " · " + f.querySelector("button").textContent : l.textContent).replace(/\s+/g, " ").trim(); })(), sec: (p.querySelector("[data-bar-pin-sec]") || { getAttribute: () => "" }).getAttribute("data-bar-pin-sec") }; });
const rootY = (page) => page.evaluate(() => document.getElementById("root").scrollTop);
const tapTab = (page, k) => page.evaluate((k) => { const b = document.querySelector(`[data-bar-pin-tab="${k}"]`) || document.querySelector(`[data-bar-tab="${k}"]`); if (b) b.click(); return !!b; }, k);
const searchVal = (page, list) => page.evaluate((list) => (document.querySelector(list + ' input[type="search"]') || {}).value, list);
// жест пальцем по карточке: TouchEvent прямо в странице (React ловит их у корня)
const swipeOn = (page, sel, dx, dy = 0, x0 = 220) => page.evaluate(([sel, dx, dy, x0]) => {
  const el = document.querySelector(sel); if (!el) return false;
  const y0 = 420, mk = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
  const pts = [mk(x0, y0), mk(x0 + dx * 0.3, y0 + dy * 0.3), mk(x0 + dx, y0 + dy)];
  el.dispatchEvent(new TouchEvent("touchstart", { touches: [pts[0]], changedTouches: [pts[0]], bubbles: true, cancelable: true }));
  el.dispatchEvent(new TouchEvent("touchmove", { touches: [pts[1]], changedTouches: [pts[1]], bubbles: true, cancelable: true }));
  el.dispatchEvent(new TouchEvent("touchmove", { touches: [pts[2]], changedTouches: [pts[2]], bubbles: true, cancelable: true }));
  el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [pts[2]], bubbles: true, cancelable: true }));
  return true;
}, [sel, dx, dy, x0]);
const hintText = (page) => page.evaluate(() => { const h = [...document.querySelectorAll(".sa-hintin")].pop(); return h ? h.innerText.replace(/\s+/g, " ").trim() : ""; });
const hintBtn = (page) => page.evaluate(() => { const h = [...document.querySelectorAll(".sa-hintin")].pop(); const b = h && [...h.querySelectorAll('[data-lens-btn="main"]')].pop(); if (b) b.click(); return b ? b.textContent : ""; });
const HINT_KEY = "sa_hint_v" + HINTS_VERSION + "_barCard";
// ── v130 ──
// холст, буфер и печать — под присмотром: что нарисовано (fillText), сколько картинок (drawImage), что скопировано, сколько
// раз позвали печать
const SPY = () => {
  window.__ft = []; window.__di = 0; window.__clip = null; window.__printed = 0;
  const P = CanvasRenderingContext2D.prototype, ft = P.fillText, di = P.drawImage;
  P.fillText = function (t) { try { window.__ft.push(String(t)); } catch (e) {} return ft.apply(this, arguments); };
  P.drawImage = function () { window.__di++; return di.apply(this, arguments); };
  try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { window.__clip = String(t); return Promise.resolve(); } } }); } catch (e) {}
  window.print = () => { window.__printed++; };
};
const TG_SPY = () => {
  window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A1%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
    downloadFile() {}, openLink() {}, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } };
};
const drawn = (page) => page.evaluate(() => (window.__ft || []).join(" ").replace(/ /g, " ").replace(/\s+/g, " "));
const spyReset = (page) => page.evaluate(() => { window.__ft = []; window.__di = 0; window.__clip = null; });
const pr = (page) => page.evaluate(() => { const r = document.querySelector("[data-bar-print]"); if (!r) return null;
  const t = (sel) => [...r.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  return { kind: r.getAttribute("data-bar-print"), n: +r.getAttribute("data-bar-print-n"), kinds: t("[data-bar-print-kind]"), on: (r.querySelector('[data-bar-print-kind][aria-pressed="true"]') || { getAttribute: () => "" }).getAttribute("data-bar-print-kind"),
    scope: t("[data-bar-print-scope]"), scopeOn: (r.querySelector('[data-bar-print-scope][aria-pressed="true"]') || { getAttribute: () => "" }).getAttribute("data-bar-print-scope"),
    photo: (r.querySelector("[data-bar-print-photo]") || { getAttribute: () => "" }).getAttribute("data-bar-print-photo"), sum: t("[data-bar-print-sum]")[0] || "", hint: t("[data-bar-print-hint]")[0] || "",
    pages: +((r.querySelector("[data-bar-print-pages]") || { getAttribute: () => 0 }).getAttribute("data-bar-print-pages")), page: t("[data-bar-print-page]")[0] || "",
    sys: !!r.querySelector("[data-bar-print-sys]"), title: ((document.querySelector('[data-lens="back"]') || {}).nextElementSibling || {}).textContent || "" }; });
// касание «Печать» без прокрутки к ней (Playwright сам прокрутил бы страницу к кнопке — место списка было бы уже другим)
const toPrint = async (page) => { await page.evaluate(() => document.querySelector("[data-bar-print-open]").click()); return until(() => page.locator("[data-bar-print]").count(), 6000); };
const pagesReady = (page, ms = 25000) => until(async () => (await page.locator("[data-bar-print-pages]").count()) && (await page.locator("[data-bar-print-go]").innerText()).trim() === "Картинкой", ms, 300);
const imgSize = (page) => page.evaluate(() => { const i = document.querySelector("[data-bar-print-img]"); return i ? { w: i.naturalWidth, h: i.naturalHeight, ok: i.complete } : null; });
// фото бутылок отдаются с CORS (как хранилище Supabase) — их можно рисовать на холсте
const photoCors = (ctx) => ctx.route(PHOTO_HOST + "/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", headers: { "Access-Control-Allow-Origin": "*" }, body: BOTTLE }));
// стоп у «Кьянти» — на бумагу «сегодня нет» не идёт
const MENU_PS = MENU_B.map((d) => (d && d.id === "w-chi" ? { ...d, stop: { since: Date.now() - 3600e3, by: "Мария Ким" } } : d));
const DATE = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ }).format(new Date(Date.now() + SHIFT_MS));
const dishName = (n) => (MENU.find((d) => d && d.name && d.name.startsWith(n)) || {}).name || "";
const pdfPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) || []).length;

// снимки страниц листа (для глаза): E2E_PAGES=1 node e2e-v130.mjs PAGES
const savePage = async (page, name) => { const b64 = await page.evaluate(async () => { const i = document.querySelector("[data-bar-print-img]"); const r = await fetch(i.src); const b = await r.blob();
  return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(b); }); });
  writeFileSync(OUT + "/" + name + ".png", Buffer.from(b64, "base64")); };
await run("PAGES", async () => {
  if (!process.env.E2E_PAGES) return;
  const srv = srvOf(MENU_PS);
  const o = await open({ who: ANNA, srv, menu: MENU_PS, init: SPY });
  await photoCors(o.ctx);
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await toPrint(o.page);
  for (const k of ["wine", "spirit", "cocktail"]) {
    await o.page.locator(`[data-bar-print-kind="${k}"]`).click(); await sleep(300);
    await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page, 40000);
    await savePage(o.page, "page-" + k + "-1");
    if ((await pr(o.page)).pages > 1) { await o.page.locator("[data-bar-print-next]").click(); await sleep(300); await savePage(o.page, "page-" + k + "-2"); }
  }
  await o.ctx.close();
});
await run("ENTRY", async () => {
  const srv = srvOf(MENU_PS);
  const o = await open({ who: ANNA, srv, menu: MENU_PS, init: SPY });
  await hideToasts(o.page);
  for (const [tab, list, sum] of [["cocktail", "[data-bar-cocktails]", "[data-bar-ck-sum]"], ["wine", '[data-drink-kind="wine"]', "[data-wine-sum]"], ["spirit", '[data-drink-kind="spirit"]', "[data-wine-sum]"]]) {
    await openBar(o.page, tab);
    const p = await o.page.evaluate(([list, sum]) => { const b = document.querySelector(list + " [data-bar-print-open]"), s = document.querySelector(list + " " + sum); if (!b || !s) return null;
      const rb = b.getBoundingClientRect(), rs = s.getBoundingClientRect(); return { t: b.textContent.trim(), sum: s.textContent.trim(), row: Math.abs((rb.top + rb.bottom) / 2 - (rs.top + rs.bottom) / 2) < 8, right: rb.right > rs.right, svg: !!b.querySelector("svg") }; }, [list, sum]);
    ok(`ENTRY: «${tab === "cocktail" ? "Коктейли" : tab === "wine" ? "Вина" : "Крепкое"}» — «Печать» со значком принтера справа от «${(p && p.sum) || "?"}»`, !!p && p.t === "Печать" && p.row && p.right && p.svg, JSON.stringify(p));
  }
  await shot(o.page, "entry-spirit");
  // вина: поиск и место в списке — «Печать» — «назад» туда же
  await openBar(o.page, "wine");
  await o.page.locator('[data-drink-kind="wine"] input[type="search"]').fill("франция"); await sleep(500);
  await scrollBy(o.page, 260); await sleep(400);
  const y0 = await rootY(o.page);
  await toPrint(o.page);
  const a = await pr(o.page);
  ok("ENTRY: экран «Барная карта для печати», сверху «Барная карта · экспорт»", !!a && /Барная карта для печати/.test(a.title) && (await kicker(o.page)) === "Барная карта · экспорт" && (await rootY(o.page)) === 0, JSON.stringify(a));
  ok("ENTRY: что печатать — «Коктейли · 57 · Вина · 6 · Крепкое · 7 · Вся карта · 70», выбрана вкладка «Вина»", !!a && a.on === "wine" && a.kinds.join(" | ") === "Коктейли · 57 | Вина · 6 | Крепкое · 7 | Вся карта · 70", JSON.stringify(a && a.kinds));
  ok("ENTRY: был поиск — «Только показанные: по запросу «франция», 3» (выбрано) и «Все 6»", !!a && a.scopeOn === "shown" && a.scope.join(" | ") === "Только показанные: по запросу «франция», 3 | Все 6" && a.n === 3, JSON.stringify(a && [a.scope, a.n]));
  ok("ENTRY: «Позиций: 3. Страницы под А4…», «Печать» откроет системный диалог", !!a && /^Позиций: 3\. Страницы под А4: сохраняются в галерею и уходят в любой мессенджер, коды входа не нужны\. «Печать» откроет системный диалог: принтер или PDF\.$/.test(a.sum) && a.sys, a && a.sum);
  ok("ENTRY: фото бутылок есть («Пино Нуар») — «С фото бутылок ✓»", !!a && a.photo === "on", JSON.stringify(a && a.photo));
  await shot(o.page, "entry-print");
  await back(o.page); await sleep(500);
  ok("ENTRY: «назад» — та же вкладка, тот же поиск и то же место", (await searchVal(o.page, '[data-drink-kind="wine"]')) === "франция" && Math.abs((await rootY(o.page)) - y0) <= 4, JSON.stringify([await searchVal(o.page, '[data-drink-kind="wine"]'), y0, await rootY(o.page)]));
  // раздел у вин, основа у коктейлей
  await o.page.locator("[data-bar-search-clear]").click(); await sleep(300);
  await o.page.locator('[data-wine-only="glass"]').click(); await sleep(400);
  await toPrint(o.page);
  const b = await pr(o.page);
  ok("ENTRY: раздел «Бокалом» — «Только показанные: Бокалом, 3»", !!b && b.scope[0] === "Только показанные: Бокалом, 3" && b.n === 3, JSON.stringify(b && b.scope));
  await o.page.locator('[data-bar-print-scope="all"]').click(); await sleep(300);
  ok("ENTRY: «Все 6» — шесть вин", (await pr(o.page)).n === 6);
  await o.page.locator('[data-bar-print-kind="spirit"]').click(); await sleep(300);
  const c = await pr(o.page);
  ok("ENTRY: «Крепкое» — семь позиций, выбора «показанные» нет (он про вина)", c.n === 7 && !c.scope.length && c.on === "spirit", JSON.stringify(c));
  await back(o.page);
  await openBar(o.page, "cocktail");
  await o.page.locator('[data-bar-ck-only="Ром"]').click(); await sleep(400);
  await toPrint(o.page);
  const d = await pr(o.page);
  ok("ENTRY: коктейли — основа «Ром»: «Только показанные: Ром, N»", !!d && d.on === "cocktail" && /^Только показанные: Ром, \d+$/.test(d.scope[0] || "") && d.n === +((d.scope[0] || "").match(/\d+$/) || [0])[0], JSON.stringify(d && d.scope));
  await back(o.page);
  ok("ENTRY: «назад» — «Ром» так и выбран", (await o.page.locator('[data-bar-ck-only="Ром"][aria-pressed="true"]').count()) === 1);
  const [e1, e2] = noErr(o); ok("ENTRY: без ошибок", e1, e2);
  await o.ctx.close();
  // без вин и крепкого — только коктейли, «Вся карта» не нужна
  const s2 = srvOf(MENU), b2 = await open({ who: ANNA, srv: s2, menu: MENU, init: SPY });
  await hideToasts(b2.page);
  await openBar(b2.page);
  await toPrint(b2.page);
  const e = await pr(b2.page);
  ok("ENTRY: в карте одни коктейли — «Коктейли · 56», без «Вся карта» и без фото", !!e && e.kinds.join("|") === "Коктейли · 56" && !e.photo, JSON.stringify(e));
  await b2.ctx.close();
});

await run("SHEET", async () => {
  const srv = srvOf(MENU_PS);
  const o = await open({ who: ANNA, srv, menu: MENU_PS, init: SPY });
  await photoCors(o.ctx);
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await toPrint(o.page);
  await spyReset(o.page);
  await o.page.locator("[data-bar-print-go]").click();
  ok("SHEET: «Картинкой» — страницы", !!(await pagesReady(o.page)));
  const a = await pr(o.page), t = await drawn(o.page), sz = await imgSize(o.page);
  ok("SHEET: страница — 1520 × 2148 точек (А4: 760 × 1074, вдвое чётче)", !!sz && sz.w === 1520 && sz.h === 2148, JSON.stringify(sz));
  ok(`SHEET: шапка «Два моря, Океан · барная карта», «Вина · 6 позиций · ${DATE} · страница 1 из ${a.pages}», подвал`, t.includes("Два моря, Океан · барная карта") && t.includes(`Вина · 6 позиций · ${DATE} · страница 1 из ${a.pages}`)
    && t.includes(`Service Academy · как в «Барной карте» · 1/${a.pages}`) && a.page === "Страница 1 из " + a.pages, t.slice(0, 300));
  ok("SHEET: разделы как в карте — ИГРИСТЫЕ, БЕЛЫЕ, РОЗОВЫЕ, КРАСНЫЕ", ["ИГРИСТЫЕ", "БЕЛЫЕ", "РОЗОВЫЕ", "КРАСНЫЕ"].every((s) => t.includes(s)) && t.indexOf("ИГРИСТЫЕ") < t.indexOf("БЕЛЫЕ") && t.indexOf("БЕЛЫЕ") < t.indexOf("КРАСНЫЕ"));
  const pair = dishName("Закуска из морепродуктов");
  ok("SHEET: «Шабли 2022» — как в карточке: производитель, откуда и сорт, цена, ноты, подача, фраза гостю, к блюдам", ["Шабли 2022", "Domaine Laroche", "Франция, Бургундия · шардоне · белое сухое", "бокал 950 ₽ · бутылка 5 200 ₽",
    "Ноты: зелёное яблоко, мел", "Подача: 8–10 °C · бокал «бургундия»", "Гостю: «Свежее и минеральное: к морепродуктам.»", "К блюдам: " + pair].every((s) => t.includes(s)), t.slice(t.indexOf("Шабли"), t.indexOf("Шабли") + 400));
  ok("SHEET: розе с полями от AI — «Не проверено: сорт, ноты, фраза гостю»", t.includes("Не проверено: сорт, ноты, фраза гостю"));
  ok("SHEET: «Кьянти» в стопе — на листе, но без «сегодня нет»; «Старое Мерло» из архива — нет", t.includes("Кьянти Классико") && !t.includes("сегодня нет") && !t.includes("Старое Мерло"));
  const di1 = await o.page.evaluate(() => window.__di);
  ok("SHEET: фото «Пино Нуар» — на листе (картинка на холсте)", di1 >= 1, String(di1));
  await shot(o.page, "sheet-wines");
  // без фото — ни одной картинки, колонки фото нет
  await o.page.locator("[data-bar-print-photo]").click(); await sleep(300);
  ok("SHEET: «Без фото» — прежние страницы убраны", !(await o.page.locator("[data-bar-print-pages]").count()) && (await pr(o.page)).photo === "off");
  await spyReset(o.page);
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page);
  ok("SHEET: без фото — ни одной картинки на холсте", (await o.page.evaluate(() => window.__di)) === 0);
  // крепкое: в коктейлях нашего бара, к блюдам
  await o.page.locator('[data-bar-print-kind="spirit"]').click(); await sleep(300);
  await spyReset(o.page);
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page);
  const s = await drawn(o.page);
  ok("SHEET: крепкое — «Glenfiddich 12», «Шотландия, Спейсайд · виски, односолодовый · 40%», «40 мл 650 ₽ · бутылка 9 800 ₽», «К блюдам: Крабовая котлета…»",
    ["Glenfiddich 12", "William Grant & Sons", "Шотландия, Спейсайд · виски, односолодовый · 40%", "40 мл 650 ₽ · бутылка 9 800 ₽", "К блюдам: " + dishName("Крабовая котлета")].every((x) => s.includes(x)) && s.includes("Крепкое · 7 позиций"), s.slice(0, 400));
  ok("SHEET: Campari — «В коктейлях: … Негрони …»", /В коктейлях: [^.]*Негрони/.test(s), s.slice(s.indexOf("Campari"), s.indexOf("Campari") + 200));
  // коктейли: бокал, состав с граммовкой, как готовить, крепкое из нашей карты, свой — с меткой
  await o.page.locator('[data-bar-print-kind="cocktail"]').click(); await sleep(300);
  await spyReset(o.page);
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page, 40000);
  const k = await drawn(o.page), kp = await pr(o.page);
  const ng = k.slice(k.indexOf("Негрони"), k.indexOf("Негрони") + 500);
  ok("SHEET: «Негрони» — состав «Джин 30 мл · Кампари 30 мл…», «Как готовить: 1. …», «Из нашей карты: Beefeater, Campari», «Гостю: «…»»", /Джин 30 мл · Кампари 30 мл/.test(ng) && /Как готовить: 1\. /.test(ng) && ng.includes("Из нашей карты: Beefeater, Campari") && /Гостю: «/.test(ng), ng);
  ok("SHEET: свой «Морской бриз по-нашему» — метка «свой», шаги «1. Лёд в хайбол → 2. Водка и морс»", k.includes("Морской бриз по-нашему свой") && k.includes("Как готовить: 1. Лёд в хайбол → 2. Водка и морс"), k.slice(k.indexOf("Морской бриз"), k.indexOf("Морской бриз") + 200));
  ok(`SHEET: 57 коктейлей — ${kp.pages} страниц, номера по порядку, бокалы нарисованы (без картинок)`, kp.pages >= 6 && Array.from({ length: kp.pages }, (_, i) => `страница ${i + 1} из ${kp.pages}`).every((x) => k.includes(x)) && (await o.page.evaluate(() => window.__di)) === 0, String(kp.pages));
  // листать страницы
  await o.page.locator("[data-bar-print-next]").click(); await sleep(200); await o.page.locator("[data-bar-print-next]").click(); await sleep(200);
  ok("SHEET: ‹ › листают: «Страница 3 из N»", (await pr(o.page)).page === "Страница 3 из " + kp.pages);
  await o.page.locator("[data-bar-print-prev]").click(); await sleep(200);
  ok("SHEET: ‹ — «Страница 2»", (await pr(o.page)).page === "Страница 2 из " + kp.pages);
  await shot(o.page, "sheet-cocktails");
  // вся карта: коктейли, вина, крепкое — каждый с новой страницы, номера сквозные
  await o.page.locator('[data-bar-print-kind="all"]').click(); await sleep(300);
  await spyReset(o.page);
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page, 45000);
  const w = await drawn(o.page), wp = await pr(o.page);
  const hd = (lbl) => (w.match(new RegExp(lbl + " · \\d+ позици[яий]+ · [\\d.]+ · страница (\\d+) из " + wp.pages, "g")) || []).map((x) => +x.match(/страница (\d+)/)[1]);
  const ck = hd("Коктейли"), wn = hd("Вина"), sp = hd("Крепкое");
  ok(`SHEET: «Вся карта» — ${wp.pages} страниц: коктейли, потом вина, потом крепкое, номера сквозные`, wp.n === 70 && ck.length && wn.length && sp.length && ck[ck.length - 1] < wn[0] && wn[wn.length - 1] < sp[0] && ck.length + wn.length + sp.length === wp.pages, JSON.stringify({ ck, wn, sp, n: wp.pages }));
  const [e1, e2] = noErr(o); ok("SHEET: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SEND", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B, init: SPY, downloads: true });
  await hideToasts(o.page);
  await openBar(o.page, "spirit");
  await toPrint(o.page);
  // «Текстом» — в буфер
  await o.page.locator("[data-bar-print-text]").click(); await sleep(300);
  const clip = await o.page.evaluate(() => window.__clip);
  ok("SEND: «Текстом» — «Скопировано ✓»", (await o.page.locator("[data-bar-print-text]").innerText()).trim() === "Скопировано ✓");
  ok("SEND: в буфере — «БАРНАЯ КАРТА · ДВА МОРЯ, ОКЕАН», дата, «КРЕПКОЕ · 7 ПОЗИЦИЙ», разделы и позиции", !!clip && clip.startsWith("БАРНАЯ КАРТА · ДВА МОРЯ, ОКЕАН\n" + DATE + "\n\n\nКРЕПКОЕ · 7 ПОЗИЦИЙ\n\nВИСКИ\n\n")
    && clip.includes("Glenfiddich 12\nWilliam Grant & Sons\nШотландия, Спейсайд · виски, односолодовый · 40%\n40 мл 650 ₽ · бутылка 9 800 ₽") && clip.includes("Не проверено: ноты, фраза гостю") && !/ /.test(clip), (clip || "").slice(0, 300));
  // «Картинкой» → «Отправить страницу», «Все N»: без «Поделиться» в браузере — файлы
  await o.page.locator('[data-bar-print-kind="cocktail"]').click(); await sleep(300);
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page, 40000);
  const n = (await pr(o.page)).pages;
  const [d1] = await Promise.all([o.page.waitForEvent("download", { timeout: 8000 }), o.page.locator('[data-bar-print-share="page"]').click()]);
  ok("SEND: «Отправить страницу» — файл «Барная_карта_Два_моря_Океан_1.png»", d1.suggestedFilename() === "Барная_карта_Два_моря_Океан_1.png", d1.suggestedFilename());
  const got = [];
  o.page.on("download", (d) => got.push(d.suggestedFilename()));
  await o.page.locator('[data-bar-print-share="all"]').click();
  await until(() => got.length >= n, 9000);
  ok(`SEND: «Все ${n}» — ${n} файлов по порядку`, got.length === n && got.every((f, i) => f === `Барная_карта_Два_моря_Океан_${i + 1}.png`), JSON.stringify(got));
  await o.page.locator("[data-bar-print-close]").click(); await sleep(300);
  ok("SEND: «Закрыть» — страниц нет", !(await o.page.locator("[data-bar-print-pages]").count()));
  // «Печать»: страницы те же, по одной на лист А4; печать позвали один раз
  await o.page.locator("[data-bar-print-sys]").click();
  ok("SEND: «Печать» — сначала собирает страницы, потом системный диалог", !!(await until(() => o.page.evaluate(() => window.__printed === 1), 40000)));
  const n2 = (await pr(o.page)).pages;
  const onScreen = await o.page.evaluate(() => ({ imgs: document.querySelectorAll("#sa-bar-print img").length, disp: getComputedStyle(document.getElementById("sa-bar-print")).display, parent: document.getElementById("sa-bar-print").parentElement === document.body }));
  ok("SEND: на экране листа для принтера не видно, он прямо в body, картинок — сколько страниц", onScreen.disp === "none" && onScreen.parent && onScreen.imgs === n2, JSON.stringify(onScreen));
  await o.page.emulateMedia({ media: "print" });
  const inPrint = await o.page.evaluate(() => ({ root: getComputedStyle(document.getElementById("root")).display, box: getComputedStyle(document.getElementById("sa-bar-print")).display }));
  const pdf = await o.page.pdf({ preferCSSPageSize: true, printBackground: true });
  await o.page.emulateMedia({ media: "screen" });
  ok(`SEND: на бумаге — только страницы: ${n2} страниц А4, ни одна не переползла`, inPrint.root === "none" && inPrint.box === "block" && pdfPages(pdf) === n2, JSON.stringify({ ...inPrint, pdf: pdfPages(pdf), n2 }));
  const [e1, e2] = noErr(o); ok("SEND: без ошибок", e1, e2);
  await o.ctx.close();
  // Telegram: печати нет — там «Отправить»
  const s2 = srvOf(MENU_B), t = await open({ who: ANNA, srv: s2, menu: MENU_B, init: TG_SPY });
  await hideToasts(t.page);
  await openBar(t.page, "wine");
  await toPrint(t.page);
  const tp = await pr(t.page);
  ok("SEND: в Telegram кнопки «Печать» нет, сказано, что делать", !!tp && !tp.sys && tp.sum.endsWith("В Telegram печать закрыта: отправь страницы себе или сохрани в галерею и печатай оттуда."), tp && tp.sum);
  await shot(t.page, "send-telegram");
  await t.ctx.close();
});

// «Поделиться в чат»: карточка вина, крепкого и коктейля → чат команды → «Открыть в Барной карте»
const chatBack0 = async (page) => {
  if (await page.locator("[data-chat-shareto]").count()) { await page.locator("[data-chat-shareto] [data-sa-back]").first().click({ timeout: 3000 }).catch(() => {}); await sleep(500); }
  for (let i = 0; i < 3 && (await page.locator("[data-chat]").count()); i++) { await page.locator("[data-chat] .ch-back").first().click({ timeout: 3000 }).catch(() => {}); await sleep(700); }
};
const openChatTeam = async (page) => { await page.locator("[data-chat-dock]").first().click(); await sleep(900); await until(() => page.locator("[data-chat-item='team']").count(), 6000); await page.locator("[data-chat-item='team']").click(); await sleep(1200); };
const shareCard = (page) => page.locator('[data-chat-card="share"]').last();
await run("SHARE", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-row="w-cha"]').click(); await sleep(500);
  const pill = o.page.locator('[data-share-chat="wine:w-cha"]');
  ok("SHARE: в карточке вина — «Поделиться в чат»", (await pill.count()) === 1 && (await pill.innerText()).trim() === "Поделиться в чат");
  await shot(o.page, "share-wine-pill");
  await pill.click();
  ok("SHARE: лист «Поделиться в чат»: «Шабли 2022», откуда и цена", !!(await until(() => o.page.locator('[data-chat-shareto="wine:w-cha"]').count(), 6000))
    && /^Шабли 2022/.test(await txt(o.page.locator("[data-chat-shareto] .ch-share-it .ch-opt-t"))) && /Франция, Бургундия · шардоне · белое сухое · бокал 950 ₽ · бутылка 5 200 ₽/.test(nb(await txt(o.page.locator("[data-chat-shareto] .ch-share-it .ch-opt-s")))),
    nb(await txt(o.page.locator("[data-chat-shareto] .ch-share-it"))));
  await o.page.locator("[data-chat-share-note]").fill("Новинка бокалом");
  await o.page.locator("[data-chat-shareto-chat='team']").click();
  ok("SHARE: в «Вся команда» — карточка «Вино» с парой слов", !!(await until(() => srv.S.msgs.some((m) => m.emp === "e-anna" && m.card && m.card.t === "share" && m.card.item.kind === "wine" && m.card.item.id === "w-cha" && m.card.note === "Новинка бокалом"), 6000))
    && !!(await until(() => o.page.locator('[data-chat-card="share"]').count(), 6000)));
  const cardT = await txt(shareCard(o.page));
  ok("SHARE: в чате — «Вино», «Шабли 2022», «Открыть в Барной карте»", /^вино/i.test(cardT) && cardT.includes("Шабли 2022") && (await shareCard(o.page).locator("[data-chat-open='wine']").innerText()).trim() === "Открыть в Барной карте", cardT);
  ok("SHARE: в списке чатов и у бота — «Вино: Шабли 2022»", [...srv.S.msgs].reverse().find((m) => m.card && m.card.t === "share").body === "Вино: Шабли 2022");
  await shot(o.page, "share-wine-card");
  await o.ctx.close();
  // Пётр — с фото бутылки «Пино Нуар» и крепким
  const b = await open({ who: PETR, srv, menu: MENU_B });
  await photoCors(b.ctx);
  await hideToasts(b.page);
  await openBar(b.page, "wine");
  await b.page.locator('[data-wine-row="w-pin"]').click(); await sleep(500);
  await b.page.locator('[data-share-chat="wine:w-pin"]').click();
  await until(() => b.page.locator('[data-chat-shareto="wine:w-pin"]').count(), 6000);
  ok("SHARE: вино с фото — в листе фото бутылки", (await b.page.locator("[data-chat-shareto] .ch-share-it img").count()) === 1);
  await b.page.locator("[data-chat-shareto-chat='team']").click();
  await until(() => srv.S.msgs.some((m) => m.card && m.card.t === "share" && m.card.item.id === "w-pin"), 6000);
  ok("SHARE: в карточке чата — ссылка на фото (https)", ([...srv.S.msgs].reverse().find((m) => m.card && m.card.t === "share").card.item.img || "").startsWith(PHOTO_HOST + "/"));
  await chatBack0(b.page);
  // коктейль из карточки здесь же
  await openBar(b.page, "cocktail");
  await b.page.locator('[data-bar-ck="negroni"]').click(); await sleep(500);
  const ckPill = b.page.locator('[data-share-chat="cocktail:negroni"]');
  ok("SHARE: в карточке коктейля в «Барной карте» — тоже «Поделиться в чат»", (await ckPill.count()) === 1);
  await ckPill.click();
  ok("SHARE: коктейль — лист «Поделиться в чат» (откроется в Колоде, как раньше)", !!(await until(() => b.page.locator('[data-chat-shareto="cocktail:negroni"]').count(), 6000)));
  await chatBack0(b.page);
  // крепкое: после отправки чат открыт поверх «Барной карты» — там же «Шабли» от Анны: «Открыть в Барной карте»
  await openBar(b.page, "spirit");
  await b.page.locator('[data-wine-row="sp-gle"]').click(); await sleep(500);
  await b.page.locator('[data-share-chat="spirit:sp-gle"]').click();
  await until(() => b.page.locator('[data-chat-shareto="spirit:sp-gle"]').count(), 6000);
  await b.page.locator("[data-chat-shareto-chat='team']").click();
  ok("SHARE: крепкое — «Крепкое: Glenfiddich 12»", !!(await until(() => [...srv.S.msgs].reverse().find((m) => m.card && m.card.t === "share" && m.card.item.kind === "spirit"), 6000))
    && [...srv.S.msgs].reverse().find((m) => m.card && m.card.t === "share").body === "Крепкое: Glenfiddich 12");
  await until(() => b.page.locator('[data-chat-card="share"]').count(), 6000);
  const wineCard = b.page.locator('[data-chat-card="share"]').filter({ hasText: "Шабли 2022" }).last();
  await wineCard.scrollIntoViewIfNeeded().catch(() => {});
  await shot(b.page, "share-chat-over-bar");
  await wineCard.locator("[data-chat-open='wine']").click();
  ok("SHARE: «Открыть в Барной карте» поверх карточки крепкого — вкладка «Вина», карточка «Шабли 2022»", !!(await until(async () => (await b.page.locator("[data-chat]").count()) === 0 && (await b.page.locator('[data-wine-card="w-cha"]').count()) === 1, 6000)),
    JSON.stringify(await tabsOf(b.page)));
  await shot(b.page, "share-open");
  await back(b.page);
  ok("SHARE: «назад» из неё — список вин", (await tabsOf(b.page)).kind === "wine" && !(await b.page.locator("[data-wine-card]").count()));
  const [e1, e2] = noErr(b); ok("SHARE: без ошибок", e1, e2);
  await b.ctx.close();
  // сервер без этапа 46 — сказано словами
  const s3 = srvOf(MENU_B, { noStage46: true });
  const c = await open({ who: ANNA, srv: s3, menu: MENU_B });
  await hideToasts(c.page);
  await openBar(c.page, "wine");
  await c.page.locator('[data-wine-row="w-cha"]').click(); await sleep(500);
  await c.page.locator('[data-share-chat="wine:w-cha"]').click();
  await until(() => c.page.locator('[data-chat-shareto="wine:w-cha"]').count(), 6000);
  await c.page.locator("[data-chat-shareto-chat='team']").click();
  const err = await until(() => txt(c.page.locator("[data-chat-share-err]")), 6000);
  ok("SHARE: без этапа 46 — «Вина и крепкое в чат пойдут после обновления сервера: этап 46…»", err === "Вина и крепкое в чат пойдут после обновления сервера: этап 46 (supabase-stage46-bar-share.sql). Блюда и коктейли уже можно.", err);
  await shot(c.page, "share-no-stage");
  await c.ctx.close();
});

// Наставник знает «Барную карту»: что ушло в ai-chat (данные карты, кнопка, маркеры) и что показано под ответом
const SEND_AI = '.sa-layer button:has(path[d="M22 2L11 13"])';
const askAi = async (page, q) => { await page.locator(".sa-layer textarea").fill(q); await page.locator(SEND_AI).click(); };
await run("ASSIST", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await photoCors(o.ctx);
  await hideToasts(o.page);
  const calls = [];
  const REPLY = { "шабли": "Шабли 2022 от Domaine Laroche: свежее и минеральное, бокал 950 ₽.\n[[wine:w-cha]]\n[[go:wines|Открыть барную карту]]",
    "пино": "Пино Нуар 2020 есть и бокалом, 1 100 ₽.\n[[wine:w-pin]]", "campari": "Campari: горький апельсин, со льдом или в «Негрони».\n[[spirit:sp-cam]]" };
  await o.ctx.route("**/functions/v1/ai-chat", async (route) => {
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    calls.push(b);
    const q = String(((b.messages || []).slice(-1)[0] || {}).content || "").toLowerCase();
    const k = Object.keys(REPLY).find((x) => q.startsWith("что за " + x) || q.includes(x + " нуар") || q.startsWith("есть " + x));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: REPLY[k] || "Не знаю.", remaining: 10 }) });
  });
  await nav(o.page, "assistant", 1600);
  await askAi(o.page, "Что за шабли у нас?");
  await until(() => o.page.locator('[data-ai-card="wine:w-cha"]').count(), 8000);
  const sent = calls.length ? String(calls[calls.length - 1].messages.slice(-1)[0].content) : "";
  ok("ASSIST: в вопросе к Наставнику — «Шабли 2022» из «Барной карты» (цена, бокалом, ноты, гостю), кнопка и маркеры; не длиннее 2000",
    sent.startsWith("Что за шабли у нас?") && sent.includes("— Вино «Шабли 2022», Domaine Laroche [id: w-cha]. Франция, Бургундия · шардоне · белое сухое. Цена: бокал 950 ₽ · бутылка 5 200 ₽. Есть бокалом. Ноты: зелёное яблоко, мел.")
    && sent.includes("[[go:wines|Открыть барную карту]]") && sent.includes("[[wine:ID]] или [[spirit:ID]]") && sent.length <= 2000 && !/Секс на пляже/.test(sent), sent.slice(-700));
  const card = await txt(o.page.locator('[data-ai-card="wine:w-cha"]'));
  ok("ASSIST: под ответом — карточка вина: «Шабли 2022», откуда, цена, «Открыть в Барной карте ›»", /^Шабли 2022/.test(card) && card.includes("Франция, Бургундия") && nb(card).includes("бокал 950 ₽") && card.endsWith("Открыть в Барной карте ›"), card);
  ok("ASSIST: и кнопка «Открыть барную карту»", (await o.page.locator(".sa-layer button, .sa-layer [role=button]").filter({ hasText: "Открыть барную карту" }).count()) >= 1);
  await shot(o.page, "assist-wine");
  await askAi(o.page, "есть пино нуар бокалом?");
  ok("ASSIST: вино с фото — в карточке фото бутылки", !!(await until(() => o.page.locator('[data-ai-card="wine:w-pin"] img').count(), 8000)));
  const s2 = String(calls[calls.length - 1].messages.slice(-1)[0].content);
  ok("ASSIST: «бокалом» в вопросе — список вин бокалом", /Бокалом: Просекко DOC Extra Dry 650 ₽, Шабли 2022 950 ₽, Пино Нуар 2020 1 100 ₽\./.test(nb(s2)), nb(s2).slice(-900));
  await askAi(o.page, "что за campari?");
  ok("ASSIST: крепкое — карточка Campari", !!(await until(() => o.page.locator('[data-ai-card="spirit:sp-cam"]').count(), 8000)));
  await shot(o.page, "assist-spirit");
  await o.page.locator('[data-ai-card="wine:w-cha"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await o.page.locator('[data-ai-card="wine:w-cha"]').first().click();
  ok("ASSIST: касание карточки — «Барная карта», вкладка «Вина», карточка «Шабли 2022»", !!(await until(() => o.page.locator('[data-wine-card="w-cha"]').count(), 6000)), JSON.stringify(await tabsOf(o.page)));
  await shot(o.page, "assist-open");
  const [e1, e2] = noErr(o); ok("ASSIST: без ошибок", e1, e2);
  await o.ctx.close();
});

const look130 = async (tag, light) => {
  const P = pal(light);
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B, light, init: SPY });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-only="white"]').click(); await sleep(400);
  const chipOn = await st(o.page, '[data-wine-only][aria-pressed="true"]');
  const pl = await st(o.page, "[data-bar-print-open]");
  ok(`${tag}: «Печать» под вкладками — стекло`, !!pl && pl.bg === P.GLASS && pl.rad === "999px", JSON.stringify(pl));
  if (light) { const low = await pxAll(o.page, ["[data-bar-print-open]", "[data-wine-sum]"]); ok(`${tag}: «Печать» и строка под вкладками читаются (контраст по пикселям)`, !low.length, JSON.stringify(low)); }
  await o.page.locator('[data-wine-row="w-cha"]').click(); await sleep(500);
  const sc = await st(o.page, "[data-share-chat]");
  ok(`${tag}: «Поделиться в чат» в карточке — стекло`, !!sc && sc.bg === P.GLASS && sc.rad === "999px", JSON.stringify(sc));
  if (light) { const low = await pxAll(o.page, ["[data-share-chat]"]); ok(`${tag}: «Поделиться в чат» читается`, !low.length, JSON.stringify(low)); }
  const la = await lightAudit(o.page);
  ok(`${tag}: свет карточки вина не съедает подписи (и «Поделиться в чат»)`, !la.out.length, JSON.stringify(la).slice(0, 300));
  await shot(o.page, tag.toLowerCase() + "-share");
  await back(o.page);
  await toPrint(o.page);
  const go = await st(o.page, "[data-bar-print-go]"), tx = await st(o.page, "[data-bar-print-text]"), sy = await st(o.page, "[data-bar-print-sys]");
  ok(`${tag}: «Картинкой» — плашка, «Текстом» и «Печать» — стекло`, !!go && /gradient/.test(go.img) && !!tx && tx.bg === P.GLASS && !!sy && sy.bg === P.GLASS, JSON.stringify([go, tx, sy]).slice(0, 400));
  const kOn = await st(o.page, '[data-bar-print-kind][aria-pressed="true"]');
  ok(`${tag}: выбранное «что печатать» — как выбранный раздел карты`, !!kOn && !!chipOn && kOn.bg === chipOn.bg && kOn.color === chipOn.color && kOn.sh === chipOn.sh, JSON.stringify([kOn, chipOn]).slice(0, 400));
  await o.page.locator('[data-bar-print-scope="all"]').click(); await sleep(300);   // «Белые» без фото; все шесть — с «Пино Нуар»
  const ph = await st(o.page, "[data-bar-print-photo]");
  ok(`${tag}: «С фото бутылок ✓» — стекло с ярким ободком`, !!ph && ph.bg === P.GLASS && (light || ph.sh.includes(HI + " 0px 0px 0px 1px inset")), JSON.stringify(ph));
  if (light) {
    const low = await pxAll(o.page, ["[data-bar-print-sum]", '[data-bar-print-kind][aria-pressed="false"]', '[data-bar-print-kind][aria-pressed="true"]', '[data-bar-print-scope][aria-pressed="false"]', "[data-bar-print-photo]", "[data-bar-print-text]", "[data-bar-print-sys]"]);
    ok(`${tag}: подписи экрана печати читаются`, !low.length, JSON.stringify(low));
  }
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page);
  if (light) { const low = await pxAll(o.page, ["[data-bar-print-page]", '[data-bar-print-share="page"]', "[data-bar-print-close]"]); ok(`${tag}: «Страница 1 из N» и кнопки под листом читаются`, !low.length, JSON.stringify(low)); }
  await shot(o.page, tag.toLowerCase() + "-print");
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LENS", () => look130("LENS", false));
await run("PAPER", () => look130("PAPER", true));

await run("NARROW", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B, w: 320, h: 700, init: SPY });
  await hideToasts(o.page);
  await openBar(o.page, "spirit");
  const f1 = await fits(o.page), pr1 = await o.page.evaluate(() => { const b = document.querySelector("[data-bar-print-open]"); return b ? Math.round(b.getBoundingClientRect().right) : -1; });
  await o.page.locator('[data-wine-row="sp-gle"]').click(); await sleep(500);
  const f2 = await fits(o.page);
  await shot(o.page, "narrow-share");
  await back(o.page);
  await toPrint(o.page);
  await o.page.locator('[data-bar-print-kind="all"]').click(); await sleep(300);
  const f3 = await fits(o.page);
  const rows = await o.page.evaluate(() => new Set([...document.querySelectorAll("[data-bar-print-kind]")].map((e) => Math.round(e.getBoundingClientRect().top))).size);
  await shot(o.page, "narrow-print");
  await o.page.locator('[data-bar-print-kind="spirit"]').click(); await sleep(300);
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page);
  const f4 = await fits(o.page);
  await shot(o.page, "narrow-pages");
  ok("NARROW: 320 px — «Печать» в строке, карточка с «Поделиться в чат», экран печати и страницы помещаются; «что печатать» — в два ряда",
    f1.sw <= f1.W && pr1 > 0 && pr1 <= f1.W - 16 && f2.sw <= f2.W && f3.sw <= f3.W && f4.sw <= f4.W && rows === 2, JSON.stringify({ f1, pr1, f2, f3, f4, rows }));
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
