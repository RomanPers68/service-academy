// e2e v129 (Доп. 442): «Барная карта» — зашёл и не заблудился. Владелец (02.11): «Как ещё можем сделать удобнее барную
// карту. Что бы человек зайдя в неё не заблудился и все было интуитивно понятно?» — на восемь предложений «Давай все».
// Сервер — fake-server.js; карты — e2e-v127 (вина, крепкое, свой коктейль) и большая e2e-v128 (30 вин). Разделы:
//   WHERE    — «Барная карта · Вина / Крепкое / Коктейли» в карточках и тренировке, «Из карточки Campari», под копией
//              шапки — раздел, где ты сейчас («Розовые · 7»);
//   FILTER   — «Показаны: Красные, 7 из 30 · Показать все» под разделами и в копии (выбранный раздел в ней на виду), конец
//              списка «Это весь раздел «Красные»» и «Показать все вина»; поиск и подбор в той же строке; сброс всего сразу;
//   SEARCH   — поиск во вкладке находит и в других: «Здесь не нашлось.», «Нашлось во вкладке «Вина»», карточка с «Из поиска
//              «шабли»», «назад» — тот же поиск; «Все 24 во вкладке «Вина» ›»; свой золотой крестик, браузерный спрятан;
//   LEARN    — строка «Учить» во всех вкладках: у вин «С чего начать», «Колода», «Викторина», «Ещё», у крепкого — новинки
//              первыми, у коктейлей «Колода» и «Лаборатория»; из строки — «назад» в карту, из «Ещё» — в тренировку;
//   ARROWS   — у каждой строки золотая стрелка;
//   SWIPE    — карточки листаются пальцем (влево — следующая, вправо — предыдущая; вертикально и от края — нет);
//   REMEMBER — вкладка помнит раздел, поиск и место в списке;
//   HINT     — первый вход: три шага (вкладки, строка, «Учить»), «Понятно» — больше не показывается; без вкладок — два шага;
//   LENS, PAPER, NARROW — вид.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v129.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5330, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v129";
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

await run("WHERE", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-row="w-cha"]').click(); await sleep(500);
  ok("WHERE: в карточке вина сверху — «Барная карта · Вина»", (await kicker(o.page)) === "Барная карта · Вина", await kicker(o.page));
  await back(o.page);
  await o.page.locator('[data-bar-learn="more"]').click(); await sleep(800);
  ok("WHERE: в тренировке («Ещё») — тоже «Барная карта · Вина»", (await kicker(o.page)) === "Барная карта · Вина" && (await o.page.locator("[data-wine-train-hub]").count()) === 1, await kicker(o.page));
  await back(o.page);
  await o.page.locator('[data-bar-tab="spirit"]').click(); await sleep(700);
  await o.page.locator('[data-wine-row="sp-cam"]').click(); await sleep(500);
  ok("WHERE: в карточке крепкого — «Барная карта · Крепкое»", (await kicker(o.page)) === "Барная карта · Крепкое", await kicker(o.page));
  await o.page.locator('[data-spirit-cocktail="negroni"]').click(); await sleep(700);
  ok("WHERE: «Негрони» из карточки Campari — сверху «Из карточки Campari»", (await kicker(o.page)) === "Из карточки Campari", await kicker(o.page));
  await o.page.locator('[data-bar-ck-spirit="sp-bee"]').click(); await sleep(700);
  ok("WHERE: Beefeater из «Негрони» — «Из карточки Негрони»", (await kicker(o.page)) === "Из карточки Негрони", await kicker(o.page));
  await back(o.page); await back(o.page); await back(o.page); await sleep(300);
  await o.page.locator('[data-bar-tab="cocktail"]').click(); await sleep(700);
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(500);
  ok("WHERE: коктейль из списка — «Барная карта · Коктейли»", (await kicker(o.page)) === "Барная карта · Коктейли", await kicker(o.page));
  await shot(o.page, "where-negroni");
  const [e1, e2] = noErr(o); ok("WHERE: без ошибок", e1, e2);
  await o.ctx.close();
  // под копией шапки — раздел, где ты сейчас
  const s2 = srvOf(MENU_BIG), b = await open({ who: ANNA, srv: s2, menu: MENU_BIG });
  await hideToasts(b.page);
  await openBar(b.page, "wine");
  await b.page.evaluate(() => { const h = document.querySelector('[data-wine-group="rose"]'), r = document.getElementById("root"); r.scrollTop = h.getBoundingClientRect().top - r.getBoundingClientRect().top + r.scrollTop + 40; }); await sleep(600);
  const p1 = await pinOf(b.page);
  ok("WHERE: листаешь — под копией шапки раздел, где ты сейчас: «Розовые · 7»", !!p1 && p1.sec === "rose" && p1.line === "Розовые · 7", JSON.stringify(p1));
  await shot(b.page, "where-section");
  await b.page.evaluate(() => { const h = document.querySelector('[data-wine-group="red"]'), r = document.getElementById("root"); r.scrollTop = h.getBoundingClientRect().top - r.getBoundingClientRect().top + r.scrollTop + 40; }); await sleep(600);
  ok("WHERE: дальше — «Красные · 7»", ((await pinOf(b.page)) || {}).line === "Красные · 7", JSON.stringify(await pinOf(b.page)));
  await openBar(b.page, "cocktail");
  await b.page.evaluate(() => { const h = document.querySelector('[data-bar-ck-group="Ром"]'), r = document.getElementById("root"); r.scrollTop = h.getBoundingClientRect().top - r.getBoundingClientRect().top + r.scrollTop + 40; }); await sleep(600);
  ok("WHERE: у коктейлей — тоже («Ром · N»)", /^Ром · \d+$/.test(((await pinOf(b.page)) || {}).line || ""), JSON.stringify(await pinOf(b.page)));
  await b.ctx.close();
});

await run("FILTER", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: ANNA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  ok("FILTER: без раздела, поиска и подбора — строки «Показаны» нет", !(await o.page.locator("[data-wine-list] [data-bar-filter]").count()) && !(await o.page.locator("[data-bar-end]").count()));
  await o.page.locator('[data-wine-only="red"]').click(); await sleep(400);
  ok("FILTER: под разделами — «Показаны: Красные, 7 из 30» и «Показать все»", (await listFilter(o.page)) === "Показаны: Красные, 7 из 30 · Показать все", await listFilter(o.page));
  await scrollBy(o.page, 1500); await sleep(600);
  const p1 = await pinOf(o.page);
  ok("FILTER: пролистал — в копии сверху «Красные» на виду и строка «Показаны: Красные, 7 из 30»", !!p1 && p1.act === "red" && p1.inView && /^Показаны: Красные, 7 из 30/.test(p1.line), JSON.stringify(p1));
  await shot(o.page, "filter-red-pin");
  const end = await o.page.evaluate(() => ((document.querySelector("[data-bar-end]") || {}).innerText || "").replace(/\s+/g, " ").trim());
  ok("FILTER: в конце списка — «Это весь раздел «Красные»» и «Показать все вина»", end === "Это весь раздел «Красные» Показать все вина", end);
  await o.page.locator("[data-bar-end-all]").click(); await sleep(500);
  ok("FILTER: «Показать все вина» — снова 30 вин, строки «Показаны» нет", (await rowIds(o.page)).length === 30 && !(await o.page.locator("[data-wine-list] [data-bar-filter]").count()));
  await toTopPage(o.page);
  await o.page.locator('[data-wine-list] input[type="search"]').fill("Wine"); await sleep(400);
  await o.page.locator("[data-wine-pick-open]").click(); await sleep(300);
  await o.page.locator('[data-wine-budget="1"]').click(); await sleep(400);
  const f2 = await listFilter(o.page);
  // v136 (Доп. 449): «Подобрать гостю» стало «Фильтр» — и в строке «Показаны: …»
  ok("FILTER: поиск и фильтр — «Показаны: по запросу «Wine», фильтр, N из 30»", /^Показаны: по запросу «Wine», фильтр, \d+ из 30 · Показать все$/.test(f2), f2);
  const e2 = await o.page.evaluate(() => ((document.querySelector("[data-bar-end]") || {}).innerText || "").replace(/\s+/g, " ").trim());
  ok("FILTER: с поиском в конце — «Это всё, что нашлось»", e2 === "Это всё, что нашлось Показать все вина", e2);
  await o.page.locator("[data-wine-list] [data-bar-filter-reset]").click(); await sleep(500);
  const r = await o.page.evaluate(() => ({ rows: document.querySelectorAll("[data-wine-row]").length, q: document.querySelector('[data-wine-list] input[type="search"]').value, pick: document.querySelector("[data-wine-pick-open]").getAttribute("data-wine-pick-open") }));
  ok("FILTER: «Показать все» сбрасывает и поиск, и подбор", r.rows === 30 && r.q === "" && r.pick === "0", JSON.stringify(r));
  await openBar(o.page, "cocktail");
  await o.page.locator('[data-bar-ck-only="Ром"]').click(); await sleep(400);
  const fc = await listFilter(o.page, "[data-bar-cocktails]");
  ok("FILTER: у коктейлей — «Показаны: Ром, N из 56»", /^Показаны: Ром, \d+ из 56 · Показать все$/.test(fc), fc);
  const [x1, x2] = noErr(o); ok("FILTER: без ошибок", x1, x2);
  await o.ctx.close();
});

await run("SEARCH", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail");
  const inp = '[data-bar-cocktails] input[type="search"]';
  ok("SEARCH: пустое поле — крестика нет", !(await o.page.locator("[data-bar-search-clear]").count()));
  await o.page.locator(inp).fill("шабли"); await sleep(500);
  const s1 = await o.page.evaluate(() => ({ none: (document.querySelector("[data-bar-ck-none]") || {}).textContent || "", tabs: (document.querySelector("[data-bar-elsewhere]") || { getAttribute: () => "" }).getAttribute("data-bar-elsewhere"),
    head: ((document.querySelector('[data-bar-elsewhere-tab="wine"]') || {}).innerText || "").replace(/\s+/g, " ").trim(), items: [...document.querySelectorAll("[data-bar-elsewhere-item]")].map((e) => e.getAttribute("data-bar-elsewhere-item")) }));
  ok("SEARCH: «шабли» в коктейлях — «Здесь не нашлось.» и «Нашлось во вкладке «Вина»: Шабли 2022»", s1.none === "Здесь не нашлось." && s1.tabs === "wine" && /^Нашлось во вкладке «Вина» Шабли 2022 /.test(s1.head) && s1.items.join() === "w-cha", JSON.stringify(s1));
  // крестик браузера стилем не проверить (getComputedStyle его не видит): правило в стилях приложения и снимок
  const cl = await o.page.evaluate(() => { const b = document.querySelector("[data-bar-search-clear]"), css = (document.getElementById("sa-styles") || {}).textContent || "";
    return { btn: b ? getComputedStyle(b).color : "", rule: /input\[data-bar-search\]::-webkit-search-cancel-button[^{]*\{[^}]*display: none/.test(css) }; });
  ok("SEARCH: свой золотой крестик, браузерный спрятан", cl.btn === GOLD_L && cl.rule, JSON.stringify(cl));
  await shot(o.page, "search-elsewhere");
  await o.page.locator('[data-bar-elsewhere-item="w-cha"]').click(); await sleep(800);
  ok("SEARCH: касание — карточка «Шабли», сверху «Из поиска «шабли»»", (await o.page.locator('[data-wine-card="w-cha"]').count()) === 1 && (await kicker(o.page)) === "Из поиска «шабли»", await kicker(o.page));
  await back(o.page); await sleep(500);
  ok("SEARCH: «назад» — снова коктейли с тем же поиском", (await o.page.locator("[data-bar-cocktails]").count()) === 1 && (await searchVal(o.page, "[data-bar-cocktails]")) === "шабли");
  await o.page.locator("[data-bar-search-clear]").click(); await sleep(400);
  ok("SEARCH: крестик очищает поиск — снова весь список", (await searchVal(o.page, "[data-bar-cocktails]")) === "" && (await ckIds(o.page)).length === 57 && !(await o.page.locator("[data-bar-elsewhere]").count()));
  // нашлось и здесь, и там: в конце «Ещё нашлось во вкладке …»
  await o.page.locator(inp).fill("джин"); await sleep(500);
  const s3 = await o.page.evaluate(() => ({ rows: document.querySelectorAll("[data-bar-ck]").length, more: ((document.querySelector('[data-bar-elsewhere-tab="spirit"]') || {}).innerText || "").replace(/\s+/g, " ").trim() }));
  ok("SEARCH: «джин» — коктейли здесь и в конце «Ещё нашлось во вкладке «Крепкое»: Beefeater»", s3.rows >= 5 && /^Ещё нашлось во вкладке «Крепкое» Beefeater/.test(s3.more), JSON.stringify(s3));
  const [e1, e2] = noErr(o); ok("SEARCH: без ошибок", e1, e2);
  await o.ctx.close();
  // «Все 24 во вкладке «Вина»» — та вкладка с тем же поиском
  const s2 = srvOf(MENU_BIG), b = await open({ who: ANNA, srv: s2, menu: MENU_BIG });
  await hideToasts(b.page);
  await openBar(b.page, "cocktail");
  await b.page.locator(inp).fill("италия"); await sleep(500);
  const all = await b.page.evaluate(() => ({ btn: ((document.querySelector('[data-bar-elsewhere-all="wine"]') || {}).textContent || "").trim(), n: document.querySelectorAll('[data-bar-elsewhere-tab="wine"] [data-bar-elsewhere-item]').length }));
  ok("SEARCH: много нашлось — три строки и «Все 24 во вкладке «Вина» ›»", all.n === 3 && all.btn === "Все 24 во вкладке «Вина» ›", JSON.stringify(all));
  await b.page.locator('[data-bar-elsewhere-all="wine"]').click(); await sleep(800);
  const w = await b.page.evaluate(() => ({ kind: (document.querySelector("[data-drink-kind]") || { getAttribute: () => "" }).getAttribute("data-drink-kind"), q: (document.querySelector('[data-wine-list] input[type="search"]') || {}).value, rows: document.querySelectorAll("[data-wine-row]").length }));
  ok("SEARCH: «Все 24…» — вкладка «Вина» с тем же поиском, 24 вина", w.kind === "wine" && w.q === "италия" && w.rows === 24 && (await listFilter(b.page)) === "Показаны: по запросу «италия», 24 из 30 · Показать все", JSON.stringify(w));
  await b.ctx.close();
});

await run("LEARN", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: ANNA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  const l1 = await o.page.evaluate(() => { const row = document.querySelector("[data-bar-learn-row]"), s = document.querySelector('[data-wine-list] input[type="search"]');
    return { keys: row ? row.getAttribute("data-bar-learn-row") : "", label: row ? row.firstElementChild.textContent : "", t: [...document.querySelectorAll("[data-bar-learn]")].map((e) => e.innerText.replace(/\s+/g, " ").trim()),
      above: !!(row && s) && row.getBoundingClientRect().bottom < s.getBoundingClientRect().top, old: !!document.querySelector('[data-wine-train-open="new"], [data-lens-card][data-wine-train-open]:not([data-bar-learn])') }; });
  ok("LEARN: у вин над поиском — «Учить»: «С чего начать» (бокалом: 0 из 3), «Колода», «Викторина», «Ещё»", l1.keys === "glass,deck,quiz,more" && l1.label === "Учить" && l1.above && !l1.old
    && l1.t.join("|") === "С чего начать бокалом: 0 из 3|Колода карточки с повтором|Викторина 10 вопросов|Ещё все тренировки", JSON.stringify(l1));
  await shot(o.page, "learn-wines");
  await scrollBy(o.page, 200); await sleep(300);
  const y0 = await rootY(o.page);
  await o.page.locator('[data-bar-learn="deck"]').click(); await sleep(900);
  ok("LEARN: «Колода» — сразу колода вин", (await o.page.locator("[data-wine-deck]").count()) === 1);
  await back(o.page); await sleep(600);
  ok("LEARN: из колоды «назад» — в карту, на то же место", (await o.page.locator("[data-wine-list]").count()) === 1 && Math.abs((await rootY(o.page)) - y0) <= 4, JSON.stringify({ y0, y: await rootY(o.page) }));
  await o.page.locator('[data-bar-learn="quiz"]').click(); await sleep(900);
  ok("LEARN: «Викторина» — сразу викторина", (await o.page.locator("[data-wine-quiz], [data-wine-opt]").count()) > 0);
  await back(o.page); await sleep(600);
  ok("LEARN: из викторины «назад» — в карту", (await o.page.locator("[data-wine-list]").count()) === 1);
  await o.page.locator('[data-bar-learn="more"]').click(); await sleep(800);
  const hub = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-train]")].map((e) => e.getAttribute("data-wine-train")).join());
  ok("LEARN: «Ещё» — прежняя тренировка целиком", (await o.page.locator("[data-wine-train-hub]").count()) === 1 && /deck,quiz/.test(hub) && /say60/.test(hub) && /pron/.test(hub), hub);
  await o.page.locator('[data-wine-train="deck"]').click(); await sleep(900);
  await back(o.page); await sleep(600);
  ok("LEARN: из тренировки колода «назад» — снова в тренировку", (await o.page.locator("[data-wine-train-hub]").count()) === 1);
  await back(o.page); await sleep(500);
  await openBar(o.page, "cocktail");
  ok("LEARN: у коктейлей — «Колода» и «Лаборатория» в той же строке «Учить»", (await o.page.evaluate(() => (document.querySelector("[data-bar-learn-row]") || { getAttribute: () => "" }).getAttribute("data-bar-learn-row"))) === "deck,lab");
  const [e1, e2] = noErr(o); ok("LEARN: без ошибок", e1, e2);
  await o.ctx.close();
  // крепкое: две новинки — первыми и подсвечены
  const s2 = srvOf(MENU_B), b = await open({ who: ANNA, srv: s2, menu: MENU_B });
  await hideToasts(b.page);
  await openBar(b.page, "spirit");
  const l2 = await b.page.evaluate(() => { const n = document.querySelector('[data-bar-learn="new"]'); return { keys: (document.querySelector("[data-bar-learn-row]") || { getAttribute: () => "" }).getAttribute("data-bar-learn-row"),
    t: n ? n.innerText.replace(/\s+/g, " ").trim() : "", hi: n ? n.getAttribute("data-lens-card") : "", more: (document.querySelector('[data-bar-learn="more"]') || { getAttribute: () => null }).getAttribute("data-wine-train-open") }; });
  ok("LEARN: у крепкого новинки — первыми и подсвечены («Новинки · 2 позиции за месяц»)", l2.keys === "new,glass,deck,quiz,more" && l2.t === "Новинки 2 позиции за месяц" && l2.hi === "hi" && l2.more === "new", JSON.stringify(l2));
  await b.page.locator('[data-bar-learn="new"]').click(); await sleep(900);
  ok("LEARN: «Новинки» — колода новинок", (await b.page.locator('[data-wine-deck-only="new"]').count()) === 1);
  await b.ctx.close();
});

await run("ARROWS", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  const arrows = (sel) => o.page.evaluate((sel) => { const rows = [...document.querySelectorAll(sel)]; return { rows: rows.length, ch: rows.filter((r) => r.querySelector("[data-bar-chev]")).length,
    color: rows[0] && rows[0].querySelector("[data-bar-chev]") ? getComputedStyle(rows[0].querySelector("[data-bar-chev]")).color : "" }; }, sel);
  await openBar(o.page, "wine");
  const w = await arrows("[data-wine-row]");
  await openBar(o.page, "spirit");
  const s = await arrows("[data-wine-row]");
  await openBar(o.page, "cocktail");
  const c = await arrows("[data-bar-ck]");
  ok("ARROWS: у каждой строки вин, крепкого и коктейлей — золотая стрелка «›»", w.rows > 0 && w.ch === w.rows && s.ch === s.rows && s.rows > 0 && c.ch === c.rows && c.rows === 57 && [w, s, c].every((x) => x.color === GOLD_L), JSON.stringify([w, s, c]));
  await o.ctx.close();
});

await run("SWIPE", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: ANNA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-only="red"]').click(); await sleep(400);
  const R = await rowIds(o.page);
  await o.page.locator(`[data-wine-row="${R[0]}"]`).click(); await sleep(500);
  await swipeOn(o.page, "[data-wine-card]", -140); await sleep(500);
  const a = await stepsAt(o.page);
  ok("SWIPE: влево — следующая карточка раздела (2 из 7), въезжает справа", a.card === R[1] && a.at === "2/" + R.length && (await o.page.locator("[data-wine-card] .sa-cardpage-r").count()) === 1, JSON.stringify(a));
  await swipeOn(o.page, "[data-wine-card]", 140); await sleep(500);
  ok("SWIPE: вправо — предыдущая, въезжает слева", (await stepsAt(o.page)).card === R[0] && (await o.page.locator("[data-wine-card] .sa-cardpage-l").count()) === 1);
  await swipeOn(o.page, "[data-wine-card]", 140); await sleep(400);
  ok("SWIPE: у первой вправо — ничего (она первая)", (await stepsAt(o.page)).card === R[0]);
  await swipeOn(o.page, "[data-wine-card]", -30, 160); await sleep(400);
  ok("SWIPE: вертикальный жест — это прокрутка, карточка та же", (await stepsAt(o.page)).card === R[0]);
  await swipeOn(o.page, "[data-wine-card]", -160, 0, 12); await sleep(400);
  ok("SWIPE: от самого левого края — не листаем (там системное «назад»)", (await stepsAt(o.page)).card === R[0]);
  await back(o.page);
  await openBar(o.page, "cocktail");
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(500);
  const n0 = await stepsAt(o.page);
  await swipeOn(o.page, "[data-bar-ck-card]", -140); await sleep(500);
  const n1 = await stepsAt(o.page);
  const [a0, n] = n0.at.split("/").map(Number);
  ok("SWIPE: коктейли — так же", n1.card !== "negroni" && n1.at === (a0 + 1) + "/" + n && /Негрони$/.test(n1.prev), JSON.stringify({ n0, n1 }));
  const [e1, e2] = noErr(o); ok("SWIPE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("REMEMBER", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: ANNA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-only="white"]').click(); await sleep(400);
  await scrollBy(o.page, 600); await sleep(500);
  const yW = await rootY(o.page);
  await tapTab(o.page, "cocktail"); await sleep(800);
  ok("REMEMBER: на новой вкладке — с начала", (await o.page.locator("[data-bar-cocktails]").count()) === 1 && (await rootY(o.page)) < 5);
  await o.page.locator('[data-bar-cocktails] input[type="search"]').fill("ром"); await sleep(400);
  await scrollBy(o.page, 300); await sleep(500);
  const yC = await rootY(o.page);
  await tapTab(o.page, "wine"); await sleep(900);
  const w = await o.page.evaluate(() => ({ on: (document.querySelector('[data-wine-only][aria-pressed="true"]') || { getAttribute: () => "" }).getAttribute("data-wine-only"), y: document.getElementById("root").scrollTop }));
  ok("REMEMBER: вернулся к винам — тот же раздел «Белые» и то же место", w.on === "white" && Math.abs(w.y - yW) <= 4, JSON.stringify({ w, yW }));
  await tapTab(o.page, "cocktail"); await sleep(900);
  ok("REMEMBER: и у коктейлей — тот же поиск «ром» и место", (await searchVal(o.page, "[data-bar-cocktails]")) === "ром" && Math.abs((await rootY(o.page)) - yC) <= 4, JSON.stringify({ yC, y: await rootY(o.page) }));
  // карточка другой вкладки и «назад» — список той вкладки на месте
  await tapTab(o.page, "wine"); await sleep(900);
  const id = (await rowIds(o.page))[3];
  await o.page.locator(`[data-wine-row="${id}"]`).click(); await sleep(500);
  await back(o.page); await sleep(500);
  ok("REMEMBER: открыл и закрыл карточку — список там же", Math.abs((await rootY(o.page)) - yW) <= 40);
  const [e1, e2] = noErr(o); ok("REMEMBER: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("HINT", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await o.page.evaluate((k) => localStorage.removeItem(k), HINT_KEY);   // подсказки отмечены прочитанными при входе — эту снимаем
  await openBar(o.page);
  await until(() => hintText(o.page), 6000);
  const h1 = await hintText(o.page);
  ok("HINT: первый вход — шаг 1: «Три вкладки: коктейли, вина и крепкое…»", /Три вкладки: коктейли, вина и крепкое\. Каждая помнит, где ты остановился\./.test(h1) && /Дальше/.test(h1), h1);
  await shot(o.page, "hint-1");
  await hintBtn(o.page); await sleep(800);
  const h2 = await hintText(o.page);
  ok("HINT: шаг 2 — строка и карточка, листать пальцем", /Коснись строки, и откроется карточка\. Карточки листаются пальцем влево и вправо\./.test(h2), h2);
  await shot(o.page, "hint-2");
  await hintBtn(o.page); await sleep(800);
  const h3 = await hintText(o.page);
  ok("HINT: шаг 3 — «Учить можно прямо отсюда…», кнопка «Понятно»", /Учить можно прямо отсюда: каждая кнопка ведёт сразу в тренировку\./.test(h3) && /Понятно/.test(h3), h3);
  await shot(o.page, "hint-3");
  await hintBtn(o.page); await sleep(600);
  ok("HINT: «Понятно» — подсказки нет, отмечено", !(await hintText(o.page)) && (await lsGet(o.page, HINT_KEY)) === 1);
  await openBar(o.page, "wine"); await sleep(800);
  ok("HINT: второй вход — без подсказки", !(await hintText(o.page)));
  await o.ctx.close();
  // сотрудник, у которого в карте одни коктейли, — вкладок нет, шагов два
  const s2 = srvOf(MENU), b = await open({ who: ANNA, srv: s2, menu: MENU });
  await hideToasts(b.page);
  await b.page.evaluate((k) => localStorage.removeItem(k), HINT_KEY);
  await openBar(b.page);
  await until(() => hintText(b.page), 6000);
  const g1 = await hintText(b.page);
  ok("HINT: без вкладок — сразу «Коснись строки…» (шагов два)", /^Подсказка Коснись строки/.test(g1) && !(await b.page.locator("#sa-bar-tabs").count()), g1);
  await b.ctx.close();
});

const look129 = async (tag, light) => {
  const P = pal(light);
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B, light });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-only="white"]').click(); await sleep(400);
  const lt = await st(o.page, '[data-bar-learn="deck"]'), rs = await st(o.page, "[data-wine-list] [data-bar-filter-reset]");
  ok(`${tag}: кнопки «Учить» — карточки линзы, «Показать все» — стекло`, !!lt && /radial-gradient/.test(lt.img) && !!rs && rs.bg === P.GLASS, JSON.stringify([lt, rs]).slice(0, 300));
  if (light) {
    const low = await pxAll(o.page, ['[data-bar-learn="deck"] div div:last-child', '[data-bar-learn="glass"] div div:last-child', "[data-wine-list] [data-bar-filter] span", "[data-wine-list] [data-bar-filter-reset]", "[data-bar-end] div", "[data-bar-end-all]"]);
    ok(`${tag}: «Учить», «Показаны…» и конец списка читаются (контраст по пикселям)`, !low.length, JSON.stringify(low));
  }
  const la = await lightAudit(o.page);
  ok(`${tag}: свет карточек не съедает подписи`, !la.out.length, JSON.stringify(la).slice(0, 300));
  await shot(o.page, tag.toLowerCase() + "-learn");
  await openBar(o.page, "cocktail");
  await o.page.locator('[data-bar-cocktails] input[type="search"]').fill("шабли"); await sleep(500);
  const el = await st(o.page, "[data-bar-elsewhere-item]");
  ok(`${tag}: «Нашлось во вкладке» — карточки линзы`, !!el && /radial-gradient/.test(el.img), JSON.stringify(el).slice(0, 200));
  if (light) { const low2 = await pxAll(o.page, ["[data-bar-elsewhere-item] div div", "[data-bar-ck-none]"]); ok(`${tag}: «Нашлось во вкладке» читается`, !low2.length, JSON.stringify(low2)); }
  await shot(o.page, tag.toLowerCase() + "-elsewhere");
  await o.page.locator("[data-bar-search-clear]").click(); await sleep(300);
  await o.page.locator('[data-bar-ck-only="Ром"]').click(); await sleep(400);
  await scrollBy(o.page, 900); await sleep(500);
  if (light) { const low3 = await pxAll(o.page, ["[data-bar-pin-line] span", "[data-bar-pin] [data-bar-filter-reset]"]); ok(`${tag}: в копии шапки «Показаны…» читается`, !low3.length, JSON.stringify(low3)); }
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LENS", () => look129("LENS", false));
await run("PAPER", () => look129("PAPER", true));

await run("NARROW", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B, w: 320, h: 700 });
  await hideToasts(o.page);
  await openBar(o.page, "spirit");
  const f1 = await fits(o.page);
  const lt = await o.page.evaluate(() => { const t = [...document.querySelectorAll("[data-bar-learn]")]; return { n: t.length, cols: new Set(t.map((e) => Math.round(e.getBoundingClientRect().top))).size, out: t.filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth).length }; });
  await shot(o.page, "narrow-learn");
  await o.page.locator('[data-wine-only="whisky"]').click(); await sleep(400);
  const f2 = await fits(o.page);
  await openBar(o.page, "cocktail");
  await o.page.locator('[data-bar-cocktails] input[type="search"]').fill("шабли"); await sleep(500);
  const f3 = await fits(o.page);
  await shot(o.page, "narrow-elsewhere");
  ok("NARROW: 320 px — «Учить» по две в ряд без сдвига вбок, «Показаны…» и «Нашлось во вкладке» помещаются", f1.sw <= f1.W && f2.sw <= f2.W && f3.sw <= f3.W && lt.n === 5 && lt.cols === 3 && !lt.out, JSON.stringify({ f1, f2, f3, lt }));
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
