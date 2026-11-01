// e2e v127 (Доп. 440): «Барная карта» — коктейли, вина и крепкое под одной кнопкой; у крепкого всё, как у вин. Владелец
// (01.11): «может добавим и редактор по крепкому алкоголю?», «Общая карта, вина и крепкое… порций… на выбор, или же ручной
// ввод. Делаем сразу все, как у вин», «Да, делаем». Сервер — как у вин (fake-server.js; этап 45 — pg-check-stage45). Разделы:
//   HUB       — в Справочнике одна «Барная карта» (сколько чего), без «Нашей винной карты» и «Бар: коктейли»;
//   TABS      — «Коктейли · Вина · Крепкое», открывается та, где был; без вин — «Коктейли · Крепкое»;
//   COCKTAILS — коктейли нашего бара по основе, «Из нашей карты», поиск, касание — тот коктейль в колоде (и свой),
//               «Колода бармена», «Бар-лаборатория», «Редактор» у руководителя;
//   SPIRITS   — разделы по виду, строка с порцией, «Ходовое», карточка и «В коктейлях нашего бара»;
//   EDITOR    — «Редактор крепкого»: вид, стиль, порция чипом или своя, подача, бокал, «ходовое»; AI и импорт — крепкое;
//   TRAIN     — тренировка: новинки («Выучил новинки ✓» — этап 45, свои ключи), викторина, «Крепкое к блюду»;
//   TEAM      — «Кто выучил новинки крепкого»; нет этапа 45 — что выполнить, вина при этом работают;
//   LENS, PAPER, NOW, NARROW — вид.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v127.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5320, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v127";
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

await run("HUB", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await go(o.page, "reference", 1800);
  await until(() => o.page.locator('[data-ref-card="barcard"]').count(), 9000);
  const card = await txt(o.page.locator('[data-ref-card="barcard"]'));
  ok("HUB: в Справочнике одна «Барная карта»: сколько коктейлей, вин и крепкого (архив не считается)", /^Барная карта Коктейли \d+ · вина 6 · крепкое 7( ›)?$/.test(card), card);
  ok("HUB: «Нашей винной карты» и «Бар: коктейли» больше нет", !(await o.page.locator('[data-ref-card="winelist"], [data-ref-card="cocktails"]').count()));
  ok("HUB: у «Барной карты» — витраж, как у курсов", (await o.page.locator('[data-ref-card="barcard"] [data-ref-art="winelist"] svg').count()) === 1);
  await shot(o.page, "hub");
  const [e1, e2] = noErr(o); ok("HUB: без ошибок", e1, e2);
  await o.ctx.close();
  // в заведении, где карта бара — только классика: карточка есть, внутри — коктейли без вкладок
  const s2 = srvOf(MENU), o2 = await open({ who: ANNA, srv: s2, menu: MENU });
  await hideToasts(o2.page);
  await openBar(o2.page);
  const t2 = await tabsOf(o2.page), c2 = await txt(o2.page.locator("[data-bar-ck-sum]"));
  ok("HUB: без вин и крепкого — сразу коктейли нашего бара, без вкладок", t2.ck && !t2.tabs && /^\d+ коктейл/.test(c2), JSON.stringify({ t2, c2 }));
  await o2.ctx.close();
});

await run("TABS", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page);
  const t0 = await tabsOf(o.page);
  ok("TABS: вкладки «Коктейли · Вина · Крепкое»; в первый раз — коктейли", t0.tabs === "cocktail,wine,spirit" && t0.on === "cocktail" && t0.ck, JSON.stringify(t0));
  const names = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-tab]")].map((b) => b.textContent.trim()).join(" · "));
  ok("TABS: подписи вкладок", names === "Коктейли · Вина · Крепкое", names);
  await o.page.locator('[data-bar-tab="spirit"]').click(); await sleep(700);
  const t1 = await tabsOf(o.page), head = await txt(o.page.locator("[data-wine-list]"));
  ok("TABS: «Крепкое» — тот же экран, что у вин, со своим видом; заголовок — «Барная карта»", t1.on === "spirit" && t1.kind === "spirit" && /Барная карта/.test(head), JSON.stringify(t1));
  await shot(o.page, "tabs-spirit");
  await go(o.page, "home", 600); await openBar(o.page);
  const t2 = await tabsOf(o.page);
  ok("TABS: вернулся — открыта та вкладка, где был", t2.on === "spirit" && t2.kind === "spirit", JSON.stringify(t2));
  ok("TABS: вкладка помнится на телефоне", (await o.page.evaluate(() => localStorage.getItem("sa_bar_tab"))) === "spirit");
  await o.page.locator('[data-bar-tab="wine"]').click(); await sleep(700);
  const t3 = await tabsOf(o.page);
  ok("TABS: «Вина» — винная карта, как раньше («Учить вина»)", t3.kind === "wine" && /^Учить вина/.test(await txt(o.page.locator("[data-wine-train-open]"))), JSON.stringify(t3));
  const [e1, e2] = noErr(o); ok("TABS: без ошибок", e1, e2);
  await o.ctx.close();
  // сотрудник, у бара нет вин: «Коктейли · Крепкое»
  const s2 = srvOf(MENU_SP), o2 = await open({ who: ANNA, srv: s2, menu: MENU_SP });
  await hideToasts(o2.page);
  await openBar(o2.page);
  const t4 = await tabsOf(o2.page);
  ok("TABS: у сотрудника без вин в карте — «Коктейли · Крепкое»", t4.tabs === "cocktail,spirit", JSON.stringify(t4));
  await o2.ctx.close();
});

await run("COCKTAILS", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail");
  const g = await o.page.evaluate(() => ({ groups: [...document.querySelectorAll("[data-bar-ck-group]")].map((e) => e.getAttribute("data-bar-ck-group")),
    vodka: [...document.querySelectorAll('[data-bar-ck-group="Водка"] [data-bar-ck]')].map((e) => e.getAttribute("data-bar-ck")),
    sum: (document.querySelector("[data-bar-ck-sum]") || {}).textContent || "" }));
  ok("COCKTAILS: по основе, в порядке карты; свои — выше классики своей основы, в сводке — сколько своих",
    g.groups[0] === "Джин" && g.vodka.indexOf("ck-sea") >= 0 && g.vodka.indexOf("ck-sea") < g.vodka.indexOf("white-russian") && /^57 коктейлей · свои \d+$/.test(g.sum), JSON.stringify(g).slice(0, 300));
  const own = await txt(o.page.locator('[data-bar-ck="ck-sea"]'));
  ok("COCKTAILS: у своего — «свой», метод и бокал", /^Морской бриз по-нашему свой билд · хайбол/.test(own), own);
  const neg = await txt(o.page.locator('[data-bar-ck="negroni"] [data-bar-ck-spirits]'));
  ok("COCKTAILS: у «Негрони» — что из нашей карты в нём", neg === "Из нашей карты: Beefeater, Campari", neg);
  const of = await txt(o.page.locator('[data-bar-ck="old-fashioned"] [data-bar-ck-spirits]'));
  ok("COCKTAILS: в «Олд фэшн» на бурбоне — бурбон, а не односолодовый", of === "Из нашей карты: Maker's Mark", of);
  await shot(o.page, "cocktails");
  await o.page.locator('[data-bar-cocktails] input[type="search"]').fill("кампари"); await sleep(500);
  const found = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-ck]")].map((e) => e.getAttribute("data-bar-ck")));
  ok("COCKTAILS: поиск по ингредиенту", found.includes("negroni") && found.includes("jungle-bird") && found.length <= 6, found.join());
  await o.page.locator('[data-bar-cocktails] input[type="search"]').fill(""); await sleep(300);
  await o.page.locator('[data-bar-ck-only="Ром"]').click(); await sleep(400);
  const rum = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-ck-group]")].map((e) => e.getAttribute("data-bar-ck-group")).join());
  ok("COCKTAILS: чип основы оставляет только её", rum === "Ром", rum);
  await o.page.locator('[data-bar-ck-only="all"]').click(); await sleep(300);
  // касание — коктейль в «Колоде бармена»: на нём, даже когда свои идут первыми
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(1500);
  const f1 = await deckFront(o.page);
  ok("COCKTAILS: касание «Негрони» — колода открыта на «Негрони» (свои коктейли впереди не сбивают)", /^Негрони/i.test(f1), f1.slice(0, 80));
  await shot(o.page, "deck-negroni");
  await back(o.page); await sleep(600);
  ok("COCKTAILS: назад — снова «Барная карта» на коктейлях", (await tabsOf(o.page)).ck);
  await o.page.locator('[data-bar-ck="ck-sea"]').click(); await sleep(1500);
  const f2 = await deckFront(o.page);
  ok("COCKTAILS: свой коктейль открывается сам, а не первая карточка", /^Морской бриз по-нашему/i.test(f2), f2.slice(0, 80));
  await back(o.page); await sleep(600);
  await o.page.locator('[data-bar-learn="lab"]').click(); await sleep(1600);
  ok("COCKTAILS: «Бар-лаборатория» открывается («Сборка руками»)", !(await o.page.locator("[data-bar-cocktails]").count()) && /Сборка руками/.test(await txt(o.page.locator("body"))));
  await back(o.page); await sleep(600);
  await openBar(o.page, "cocktail");
  await o.page.locator("[data-bar-ck-edit]").click(); await sleep(1500);
  ok("COCKTAILS: руководителю — «Редактор» своих коктейлей", /Свои коктейли/.test(await txt(o.page.locator("body"))));
  const [e1, e2] = noErr(o); ok("COCKTAILS: без ошибок", e1, e2);
  await o.ctx.close();
  const s2 = srvOf(MENU_B), o2 = await open({ who: ANNA, srv: s2, menu: MENU_B });
  await hideToasts(o2.page);
  await openBar(o2.page, "cocktail");
  ok("COCKTAILS: у сотрудника «Редактора» нет, «Колода бармена» есть", !(await o2.page.locator("[data-bar-ck-edit]").count()) && (await o2.page.locator('[data-bar-learn="deck"]').count()) === 1);
  await o2.page.locator('[data-bar-learn="deck"]').click(); await sleep(1500);
  ok("COCKTAILS: «Колода бармена» — колода", (await o2.page.locator(".sa-ck-front").count()) > 0);
  await o2.ctx.close();
});

await run("SPIRITS", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "spirit");
  const L = await o.page.evaluate(() => ({ groups: [...document.querySelectorAll("[data-wine-group]")].map((e) => e.getAttribute("data-wine-group") + ":" + e.querySelectorAll("[data-wine-row]").length).join(),
    chips: [...document.querySelectorAll("[data-wine-only]")].map((e) => e.textContent.trim()).join("|"), sum: (document.querySelector("[data-wine-sum]") || {}).textContent || "" }));
  ok("SPIRITS: разделы по виду в порядке карты, архива нет", L.groups === "whisky:2,cognac:1,rum:1,gin:1,agave:1,bitter:1", JSON.stringify(L));
  ok("SPIRITS: чипы — «Все», «Ходовое» и виды", L.chips === "Все|Ходовое|Виски|Коньяк и бренди|Ром|Джин|Текила и мескаль|Биттеры и настойки", L.chips);
  const row = nb(await txt(o.page.locator('[data-wine-row="sp-gle"]')));
  ok("SPIRITS: строка — название, «ходовое», откуда и что, порция и бутылка", row === "Glenfiddich 12 ходовое Шотландия, Спейсайд · виски, односолодовый · 40% 40 мл 650 ₽ · бутылка 9 800 ₽", row);
  ok("SPIRITS: «Учить крепкое» — две новинки", /^Учить крепкое ?новое ?Новинки: 2/.test(await txt(o.page.locator("[data-wine-train-open]"))));
  await shot(o.page, "spirits");
  await o.page.locator('[data-wine-list] input[type="search"]').fill("куба"); await sleep(400);
  ok("SPIRITS: поиск по стране", (await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((e) => e.getAttribute("data-wine-row")).join())) === "sp-hav");
  await o.page.locator('[data-wine-list] input[type="search"]').fill(""); await sleep(300);
  await o.page.locator('[data-wine-only="glass"]').click(); await sleep(400);
  ok("SPIRITS: «Ходовое» — только то, что учить первым", (await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((e) => e.getAttribute("data-wine-row")).sort().join())) === "sp-bee,sp-gle,sp-mak");
  await o.page.locator('[data-wine-only="all"]').click(); await sleep(300);
  await o.page.locator('[data-wine-row="sp-mak"]').click(); await sleep(900);
  const card = nb(await txt(o.page.locator('[data-wine-card="sp-mak"]')));
  const cks = await o.page.evaluate(() => [...document.querySelectorAll("[data-spirit-cocktail]")].map((e) => e.getAttribute("data-spirit-cocktail")));
  ok("SPIRITS: карточка — откуда и что, порция и бутылка", /США, Кентукки · виски, бурбон · 45%/.test(card) && /40 мл 550 ₽ · бутылка 7 900 ₽/.test(card), card.slice(0, 200));
  ok("SPIRITS: «В коктейлях нашего бара» — на бурбоне, без «Манхэттена» на ржаном", cks.includes("old-fashioned") && !cks.includes("manhattan"), cks.join());
  await shot(o.page, "spirit-card");
  await o.page.locator('[data-spirit-cocktail="old-fashioned"]').click(); await sleep(1500);
  const f = await deckFront(o.page);
  ok("SPIRITS: касание коктейля — он в «Колоде бармена»", /^Олд фэшн/i.test(f), f.slice(0, 60));
  const [e1, e2] = noErr(o); ok("SPIRITS: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("EDITOR", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B });
  const calls = [];
  await aiRoute(o.ctx, calls, SP_ANSWER);
  await hideToasts(o.page);
  await openBar(o.page, "spirit");
  await o.page.locator("[data-wine-edit]").click(); await sleep(1500);
  const sum = await txt(o.page.locator("[data-wine-sum-line]"));
  ok("EDITOR: «Редактор крепкого» — сводка «7 позиций · ходовое 3…»", /^7 позиций · ходовое 3/.test(sum) && /Редактор крепкого/.test(await txt(o.page.locator("[data-wine-editor]"))), sum);
  await o.page.locator("[data-wine-new]").click(); await sleep(600);
  const parts = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-part]")].map((e) => e.getAttribute("data-wine-part")).join());
  ok("EDITOR: «Новая позиция» — разделы «Что это и откуда», «Подача и цена», «Как рассказать гостю», «К блюдам»", parts === "origin,serve,guest,pair", parts);
  await o.page.locator('[data-wine-field="name"]').fill("Talisker 10"); await sleep(150);
  await o.page.locator('[data-wine-cat="whisky"]').click(); await sleep(300);
  const hints = await o.page.evaluate(() => [...document.querySelectorAll('[data-wine-hints="style"] [data-wine-hint]')].map((e) => e.textContent.trim()).slice(0, 3).join(","));
  ok("EDITOR: выбрал вид — подсказки стиля этого вида (сначала свои)", /^односолодовый,бурбон/.test(hints), hints);
  await o.page.locator('[data-wine-hints="style"] [data-wine-hint]').first().click(); await sleep(200);
  await o.page.locator('[data-wine-part="serve"]').click().catch(() => {}); await sleep(300);
  await o.page.locator('[data-wine-portion="40"]').click(); await sleep(200);
  const p40 = await o.page.evaluate(() => [document.querySelector('[data-wine-portion="40"]').getAttribute("aria-pressed"), document.querySelector('[data-wine-field="portion"]').value]);
  await o.page.locator('[data-wine-field="portion"]').fill("35"); await sleep(200);
  const p35 = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-portion]")].filter((e) => e.getAttribute("aria-pressed") === "true").length);
  ok("EDITOR: порция — чипом (40 мл) или своим числом (35): тогда чипы не нажаты", p40[0] === "true" && p40[1] === "40" && p35 === 0, JSON.stringify([p40, p35]));
  await o.page.locator('[data-wine-field="pricePortion"]').fill("720");
  await o.page.locator('[data-wine-serve="чистым"]').click(); await o.page.locator('[data-wine-serve="с каплей воды"]').click();
  await o.page.locator('[data-wine-glass="гленкерн"]').click(); await o.page.locator("[data-wine-hot]").click(); await sleep(200);
  await shot(o.page, "editor-form");
  await o.page.locator("[data-wine-save]").click();
  await until(() => spirits(srv).some((w) => w.name === "Talisker 10"), 9000);
  const t = spirits(srv).find((w) => w.name === "Talisker 10") || {};
  ok("EDITOR: сохранено в меню команды крепким: вид, стиль, порция 35, цена, подача, бокал, «ходовое», дата добавления",
    t.kind === "spirit" && t.cat === "whisky" && t.style === "односолодовый" && t.portion === 35 && t.pricePortion === 720 && t.serve.join() === "чистым,с каплей воды" && t.glass === "гленкерн" && t.hot === true && t.addedAt > 0 && /^sp-/.test(t.id),
    JSON.stringify(t).slice(0, 300));
  ok("EDITOR: вина и блюда в меню не тронуты", (srv.S.menu || []).filter((d) => d && d.kind === "wine").length === 7 && (srv.S.menu || []).some((d) => d && d.id === "ck-sea"));
  // AI: «Заполнить» — запрос крепкого
  await o.page.locator("[data-wine-new]").click(); await sleep(500);
  await o.page.locator('[data-wine-field="name"]').fill("Jameson"); await sleep(100);
  await o.page.locator("[data-wine-fill]").click();
  await until(() => o.page.evaluate(() => document.querySelector('[data-wine-field="country"]').value === "Ирландия"), 6000);
  const f = calls[calls.length - 1] || {};
  const aiN = await o.page.locator("[data-wine-ai]").count();
  ok("EDITOR: «Заполнить через AI» — запрос крепкого (kind spirit), пустые поля заполнены и помечены «AI»", f.kind === "spirit" && f.mode === "fill" && f.name === "Jameson" && aiN >= 3, JSON.stringify({ f, aiN }));
  // импорт списком — тоже крепкое
  await openBar(o.page, "spirit");
  await o.page.locator("[data-wine-edit]").click(); await sleep(1300);
  await o.page.locator("[data-wine-import-open]").click(); await sleep(400);
  await o.page.locator('[data-wine-imp="text"]').click(); await sleep(300);
  await o.page.locator("[data-wine-paste]").fill("Bushmills Original\nRedbreast 12"); await sleep(100);
  await o.page.locator("[data-wine-parse]").click(); await sleep(400);
  await o.page.locator("[data-wine-ai-go]").click().catch(() => {});
  await until(() => o.page.locator('[data-wine-import="review"]').count(), 8000);
  const nm = calls.filter((c) => c.mode === "names").pop() || {};
  ok("EDITOR: импорт списком — названия уходят в AI крепкого", nm.kind === "spirit" && (nm.names || []).join("|") === "Bushmills Original|Redbreast 12", JSON.stringify(nm));
  await o.page.locator("[data-wine-add]").click();
  await until(() => spirits(srv).length >= 10, 9000);
  ok("EDITOR: из импорта — две новые позиции с пометками AI", spirits(srv).filter((w) => /^(Bushmills Original|Redbreast 12)$/.test(w.name) && w.ai.length && w.addedAt > 0).length === 2, String(spirits(srv).length));
  const [e1, e2] = noErr(o); ok("EDITOR: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("TRAIN", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await toHubS(o.page);
  const rows = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-train]")].map((e) => e.getAttribute("data-wine-train")).join());
  ok("TRAIN: «Учить крепкое» — новинки, ходовое, колода, викторина, «Крепкое к блюду», «Опиши за 60 секунд», «Как произносить» (команды у сотрудника нет)", rows === "new,glass,deck,quiz,pair,say60,pron", rows);
  const path = await txt(o.page.locator('[data-wine-train="glass"]'));
  ok("TRAIN: «С чего начать: ходовое» — выучено 0 из 3", /^С чего начать: ходовое/.test(path) && /0 из 3/.test(path), path);
  await shot(o.page, "train-hub");
  await hubOpen(o.page, "new");
  for (let i = 0; i < 2; i++) { await o.page.locator('[data-wine-mark="ok"]').click(); await sleep(450); }
  const btn = await txt(o.page.locator("[data-wine-learned]"));
  ok("TRAIN: в новинках — «Выучил новинки ✓»", btn === "Выучил новинки ✓", btn);
  await o.page.locator("[data-wine-learned]").click();
  await until(() => setsS(srv, "passed").length, 6000); await sleep(600);
  const p = setsS(srv, "passed")[0], learned = await lsGet(o.page, SLRK), sr = await lsGet(o.page, SSRK);
  ok("TRAIN: на сервер ушло «выучил новинки» крепкого (этап 45), а не вин", !!p && (p.body.p_data.ids || []).slice().sort().join() === "sp-hav,sp-mak" && !srv.calls.some((c) => c.fn === "wine_progress_set"),
    JSON.stringify(p && p.body));
  ok("TRAIN: на телефоне — свои ключи крепкого (выучено и «Знаю?»)", JSON.stringify((learned || []).slice().sort()) === '["sp-hav","sp-mak"]' && !!sr && !!sr["sp-mak"] && (await lsGet(o.page, LRK)) === null,
    JSON.stringify({ learned, sr: sr && Object.keys(sr) }));
  if (!(await until(() => o.page.locator('[data-wine-train="quiz"]').count(), 2500))) { await back(o.page); await sleep(500); }   // «Выучил» возвращает в тренировку
  await hubOpenW(o.page, "quiz");
  const q = await o.page.evaluate(() => { const e = document.querySelector("[data-wine-quiz]"); return e ? { kind: e.getAttribute("data-wine-quiz-kind"), t: e.innerText.replace(/\s+/g, " ").slice(0, 160) } : null; });
  await o.page.locator('[data-wine-opt="0"]').click(); await sleep(400);
  ok("TRAIN: викторина по крепкому — вопросы крепкого, после ответа — пояснение",
    !!q && ["kind", "place", "age", "serve", "phrase", "dish", "abv"].includes(q.kind) && /Викторина по крепкому/.test(q.t) && (await o.page.locator("[data-wine-why]").count()) === 1, JSON.stringify(q));
  await back(o.page); await sleep(500);
  await hubOpenW(o.page, "pair");
  const pq = await txt(o.page.locator("[data-wine-pairq]"));
  ok("TRAIN: «Крепкое к блюду» — «Гость заказал… Что предложить из крепкого?»", /Крепкое к блюду/.test(pq) && /Гость заказал «.+»\. Что предложить из крепкого\?/.test(pq), pq.slice(0, 160));
  await shot(o.page, "train-pair");
  const [e1, e2] = noErr(o); ok("TRAIN: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("TEAM", async () => {
  const srv = srvOf(MENU_B);
  srv.rpc("spirit_progress_set", { p_token: tok(ANNA), p_kind: "passed", p_data: { ids: ["sp-mak", "sp-hav"], stats: { known: 4, total: 6, glassKnown: 3, glassTotal: 3 } } });
  srv.rpc("spirit_progress_set", { p_token: tok(VERA), p_kind: "opened", p_data: { ids: ["sp-mak", "sp-hav"], stats: { known: 1, total: 6 } } });
  srv.rpc("spirit_progress_set", { p_token: tok(ILYA), p_kind: "stats", p_data: { stats: { known: 5, total: 6, glassKnown: 2, glassTotal: 3 } } });
  srv.rpc("wine_progress_set", { p_token: tok(PETR), p_kind: "passed", p_data: { ids: ["w-pro", "w-cha"] } });
  const o = await open({ who: MARIA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await toHubS(o.page);
  ok("TEAM: у руководителя в тренировке — «Кто выучил новинки крепкого»", /^Кто выучил новинки крепкого/.test(await txt(o.page.locator('[data-wine-train="team"]'))));
  await hubOpenW(o.page, "team"); await until(() => o.page.locator("[data-wine-team-row]").count(), 9000);
  const t = await teamOf(o.page);
  const st_ = Object.fromEntries(t.rows.map((r) => [r.id, r.state]));
  ok("TEAM: Анна выучила новинки, Вера учит, Илья не открывал; Пётр по крепкому не занимался (его вина — не сюда)",
    st_["e-anna"] === "passed" && st_["e-vera"] === "opened" && st_["e-ilya"] === "notnew" && st_["e-petr"] === "none", JSON.stringify(st_));
  ok("TEAM: сверху — новинки, итог строкой", /^Новинки: Maker's Mark, Havana Club 7/.test(t.head) || /Новинки: (Maker's Mark|Havana Club 7)/.test(t.head), t.head + " / " + t.line);
  const anna = t.rows.find((r) => r.id === "e-anna") || {};
  ok("TEAM: у Анны — «Новинки выучены ✓», «Знаю?» и ходовое", /^Новинки выучены ✓/.test(anna.status) && /«Знаю\?» 4 из 6 · ходовое 3 из 3/.test(anna.prog), JSON.stringify(anna));
  ok("TEAM: запрос — этап 45", srv.calls.some((c) => c.fn === "spirit_progress_team") && !srv.calls.some((c) => c.fn === "wine_progress_team"));
  await shot(o.page, "team");
  const [e1, e2] = noErr(o); ok("TEAM: без ошибок", e1, e2);
  await o.ctx.close();
  // этапа 45 нет: что выполнить; вина при этом работают
  const s2 = srvOf(MENU_B);
  const o2 = await open({ who: MARIA, srv: s2, menu: MENU_B, rpcs: (fn) => (fn === "spirit_progress_team" || fn === "spirit_progress_set" ? { code: "PGRST202", message: "Could not find the function" } : undefined) });
  await hideToasts(o2.page);
  await toHubS(o2.page); await hubOpenW(o2.page, "team"); await sleep(1200);
  const m = await teamOf(o2.page);
  ok("TEAM: этапа 45 нет — что выполнить, и что тогда будет видно", m.msg === "missing" && /Нужен этап базы 45: выполни supabase\/supabase-stage45-spirits\.sql в Supabase → SQL Editor\. После этого здесь будет каждый сотрудник: выучены ли новинки, сколько позиций выучено в «Знаю\?», ходовое и викторина\./.test(m.msgT),
    JSON.stringify(m).slice(0, 300));
  await openBar(o2.page, "wine");
  await o2.page.locator("[data-wine-train-open]").click(); await sleep(700);
  await hubOpenW(o2.page, "team"); await until(() => o2.page.locator("[data-wine-team-row]").count(), 9000);
  const w = await teamOf(o2.page);
  ok("TEAM: «Кто выучил новые вина» при этом работает (этап 44)", w.rows.length > 3 && !w.msg, JSON.stringify(w).slice(0, 200));
  await o2.ctx.close();
});

const barLook = async (tag, light) => {
  const P = pal(light);
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B, light });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail");
  const on = await st(o.page, '[data-bar-tab="cocktail"]'), off = await st(o.page, '[data-bar-tab="spirit"]'), row = await st(o.page, '[data-bar-ck="negroni"]');
  ok(`${tag}: активная вкладка — как вкладки линзы, остальные — без заливки`, light ? !!on && +on.fw >= 700 : isTab(on), JSON.stringify(on));
  ok(`${tag}: строки коктейлей — карточки линзы`, !!row && /radial-gradient/.test(row.img) && row.bc === P.EDGE, JSON.stringify(row).slice(0, 200));
  const low = light ? await pxAll(o.page, ['[data-bar-tab="cocktail"]', '[data-bar-tab="spirit"]', '[data-bar-ck="negroni"] [data-bar-ck-spirits]', "[data-bar-ck-sum]"]) : [];
  if (light) ok(`${tag}: вкладки и подписи читаются (контраст по пикселям)`, !low.length, JSON.stringify(low));
  const la = await lightAudit(o.page);
  ok(`${tag}: свет карточек не съедает подписи коктейлей`, la.n > 5 && !la.out.length, JSON.stringify(la).slice(0, 300));
  await shot(o.page, tag.toLowerCase() + "-cocktails");
  await o.page.locator('[data-bar-tab="spirit"]').click(); await sleep(800);
  const sr = await st(o.page, '[data-wine-row="sp-gle"]');
  ok(`${tag}: строки крепкого — карточки линзы`, !!sr && /radial-gradient/.test(sr.img) && sr.bc === P.EDGE, JSON.stringify(sr).slice(0, 200));
  const la2 = await lightAudit(o.page);
  ok(`${tag}: свет карточек не съедает подписи крепкого`, la2.n > 5 && !la2.out.length, JSON.stringify(la2).slice(0, 300));
  if (light) { const low2 = await pxAll(o.page, ['[data-wine-row="sp-gle"] span', "[data-wine-sum]"]); ok(`${tag}: строки крепкого читаются`, !low2.length, JSON.stringify(low2)); }
  await shot(o.page, tag.toLowerCase() + "-spirits");
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LENS", () => barLook("LENS", false));
await run("PAPER", () => barLook("PAPER", true));

await run("NOW", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B, seedExtra: { sa_home_look: "now" } });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail");
  const row = await st(o.page, '[data-bar-ck="negroni"]');
  ok("NOW: вид «как сейчас» — коктейли без света линзы", !!row && !/radial-gradient/.test(row.img), JSON.stringify(row && row.img));
  await o.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B, w: 320, h: 700 });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail");
  const f1 = await fits(o.page);
  const tb = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-tab]")].map((b) => b.scrollWidth <= b.clientWidth + 1).every(Boolean));
  await shot(o.page, "narrow-cocktails");
  await o.page.locator('[data-bar-tab="spirit"]').click(); await sleep(700);
  await o.page.locator('[data-wine-row="sp-gle"]').click(); await sleep(800);
  const f2 = await fits(o.page);
  await shot(o.page, "narrow-spirit-card");
  ok("NARROW: 320 px — вкладки не обрезаны, коктейли и карточка крепкого без сдвига вбок", tb && f1.sw <= f1.W && f2.sw <= f2.W, JSON.stringify({ tb, f1, f2 }));
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
