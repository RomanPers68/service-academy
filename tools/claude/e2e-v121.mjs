// e2e v121 (Доп. 434): роли в линзах. Владелец (31.10, два снимка: панель «Хостес» под «Треками обучения» и список
// «Хостес / Официант / Менеджмент / Бар» с «На подходе»): «И может ещё роли в эффект линзы?». Разделы:
//   PANEL — панель выбранного трека (ui/tracks-row.jsx): карточка линзы без внешней тени, язычок и черта золотом,
//           «Открыть ›» — плашка с кольцом, «свернуть» — линза 32 px, строки уступают ей место, высота панели та же,
//           что в виде «как сейчас»; «твой» — стекло; «свернуть» и тап по панели работают;
//   LIST  — список треков (ui/screens-roleselect.jsx): роли и профессии — карточки линзы, значки — линзы с оттенком роли
//           (у закрытых — без оттенка), значок прежнего размера; ступени — кромка, номера — линзы на плотном тоне;
//           «На подходе» — карточки, значки линзами, «скоро» стеклом; свет карточек не съедает подписи;
//   PAPER — «Для чтения»: те же метки, контраст по пикселям; NOW — вид «как сейчас» прежний; WIDE — две колонки;
//   NARROW — 360 и 320 px: строки панели в одну строку, плашка и кольца в панели, без сдвига вбок.
//   HR    — ряд ответа AI-интервью (владелец: «Ответ голосом съехал вниз»): микрофон и волна по линии поля, в «Линзе»
//           кольца не сходятся и не выходят за край ленты; с текстом — «Отправить» на той же линии, у последней строки;
//   INK   — чёрный текст по умолчанию (цвет нигде не задан) на тёмной теме (владелец: «В вкладке новички, текст на тёмной
//           теме чёрный»): «Новички» без новичков у руководителя и у наставника без подопечных.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] [E2E_LOOK=now] node e2e-v121.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v121";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v121";
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

const shown = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].some((x) => { const r = x.getBoundingClientRect(), s = getComputedStyle(x);
  return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; }), sel);
const clickText = (page, sel, t) => page.evaluate(([sel, t]) => { const e = [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null && x.textContent.trim().startsWith(t)).pop(); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } return !!e; }, [sel, t]);
const go = async (page, s, ms = 2400) => { await nav(page, "home", 800); await nav(page, s, ms); };
const hideToasts = (page) => page.addStyleTag({ content: "[data-ms-toast]{display:none!important}" });
const pxAll = async (page, sels) => { const out = []; for (const s of sels) { const r = await pxRatio(page, s); if (r && r.r < r.need) out.push(r.t + " " + r.r + "/" + r.need); else if (!r) out.push("нет " + s); } return out; };

// ── v121: панель трека и список треков ──
const L = { GLASS: "rgba(139, 106, 48, 0.09)", RING: "rgba(139, 106, 48, 0.32)", EDGE: "rgba(139, 106, 48, 0.3)", RIM: "rgba(139, 106, 48, 0.48) 0px 0px 0px 1px inset",
  HL: "rgba(255, 255, 255, 0.95) 0px 1.5px 0px 0px inset", INK: "rgb(107, 78, 26)", PRING: "rgba(139, 106, 48, 0.45)" };
const D = { GLASS, RING, EDGE, RIM, HL, INK: HI, PRING: RING };
const parts = (sh) => String(sh || "").split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => x && x !== "none");
const home = async (o) => { await hideToasts(o.page); await until(() => o.page.locator("[data-track-chip]").count(), 9000); await sleep(600); };
const chip = async (page, id) => { await page.evaluate((id) => { const b = document.querySelector(`[data-track-chip="${id}"]`); if (b) { b.scrollIntoView({ block: "center" }); b.click(); } }, id); await sleep(700); };
const panelProbe = (page) => page.evaluate(() => {
  const pn = document.querySelector("[data-track-panel]"); if (!pn) return null;
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: +r.left.toFixed(1), r: +r.right.toFixed(1), t: +r.top.toFixed(1), b: +r.bottom.toFixed(1), w: Math.round(r.width), h: Math.round(r.height) }; };
  const one = (e) => { if (!e) return null; const s = getComputedStyle(e), a = getComputedStyle(e, "::after");
    return { bg: s.backgroundColor, img: s.backgroundImage, bc: s.borderTopColor, sh: s.boxShadow, color: s.color, fw: s.fontWeight, fs: s.fontSize, rad: s.borderTopLeftRadius, pad: s.padding,
      ring: a.content !== "none" && a.content !== "normal" ? a.borderTopColor : "", ...box(e) }; };
  const inn = pn.querySelector(".sa-panel-in");
  const q = (s) => inn && inn.querySelector(s);
  const head = q("[data-track-head]"), desc = q("[data-track-desc]");
  const pr = pn.getBoundingClientRect();
  const row3 = inn && inn.children[2];
  return {
    p: one(pn), x: one(pn.querySelector("[data-track-close]")), go: one(q("[data-track-go]")), mine: one(q("[data-track-mine]")),
    notch: (() => { const n = document.querySelector("[data-track-notch]"); return n ? getComputedStyle(n).borderBottomColor : null; })(),
    line: (() => { const n = pn.querySelector("[data-track-line]"); return n ? getComputedStyle(n).backgroundImage : null; })(),
    lines: inn ? [...inn.children].map((c) => Math.round(c.getBoundingClientRect().height)) : [],
    head: head ? { ...box(head), pad: getComputedStyle(head).paddingRight } : null, desc: desc ? { ...box(desc), pad: getComputedStyle(desc).paddingRight } : null,
    // насколько содержимое третьей строки шире её самой (по рамкам детей; кольцо плашки ::after не в счёт)
    row3: row3 ? { over: Math.max(0, ...[...row3.children].map((c) => c.getBoundingClientRect().right)) - row3.getBoundingClientRect().right, ...box(row3) } : null,
    text: pn.innerText.replace(/\s+/g, " ").trim(), pl: +pr.left.toFixed(1), pr: +pr.right.toFixed(1), pt: +pr.top.toFixed(1), pb: +pr.bottom.toFixed(1), h: +pr.height.toFixed(1),
  };
});
const listProbe = (page) => page.evaluate(() => {
  const one = (e) => { if (!e) return null; const s = getComputedStyle(e), a = getComputedStyle(e, "::after"), r = e.getBoundingClientRect();
    return { bg: s.backgroundColor, img: s.backgroundImage, bc: s.borderTopColor, sh: s.boxShadow, color: s.color, rad: s.borderTopLeftRadius, op: s.opacity,
      ring: a.content !== "none" && a.content !== "normal" ? a.borderTopColor : "", w: Math.round(r.width), h: Math.round(r.height), l: r.left, r: r.right, t: r.top, b: r.bottom }; };
  const cards = [...document.querySelectorAll("[data-role-card],[data-group-card]")].filter((c) => c.offsetParent !== null).map((c) => {
    const d = c.querySelector(':scope > [data-lens="disc"]'), svg = d && d.querySelector(":scope > svg");
    return { id: c.getAttribute("data-role-card") || c.getAttribute("data-group-card"), card: one(c), disc: one(d), svgT: svg ? getComputedStyle(svg).transform : null, svgW: svg ? Math.round(svg.getBoundingClientRect().width) : null };
  });
  const steps = [...document.querySelectorAll(".sa-tracksub.open [data-step-card]")].filter((c) => c.offsetParent !== null).map((c) => {
    const n = c.querySelector(".sa-stepnum"), sub = c.closest(".sa-tracksub"), sr = sub ? sub.getBoundingClientRect() : null;
    return { id: c.getAttribute("data-step-card"), cls: c.className, card: one(c), num: one(n), numTxt: n ? n.textContent.trim() : "", subL: sr ? sr.left : null, subT: sr ? sr.top : null, subB: sr ? sr.bottom : null };
  });
  const soon = [...document.querySelectorAll("[data-soon-card]")].map((c) => ({ id: c.getAttribute("data-soon-card"), card: one(c), disc: one(c.querySelector('[data-lens="disc"]')), tag: one(c.querySelector("[data-soon-tag]")) }));
  return { cards, steps, soon };
});
const openList = async (page) => { await page.evaluate(() => { const t = document.querySelector('[data-tracks-toggle="closed"]'); if (t) { t.scrollIntoView({ block: "center" }); t.click(); } }); await sleep(900); };
const openGroup = async (page, id) => { await page.evaluate((id) => { const g = document.querySelector(`[data-group-card="${id}"]`); if (g) { g.scrollIntoView({ block: "center" }); g.click(); } }, id); await sleep(900); };
const allInset = (sh) => parts(sh).length > 0 && parts(sh).every((x) => /inset$/.test(x));
const tintOf = (sh) => (parts(sh).find((x) => /0px -9px 12px -7px inset$/.test(x)) || "").replace(/ 0px -9px 12px -7px inset$/, "");
const discOk = (x, T) => !!x && x.bg === T.GLASS && x.ring === T.RING && x.sh.includes(T.RIM) && x.rad === "50%";
const cardOk = (x, T) => !!x && /radial-gradient/.test(x.img) && x.bc === T.EDGE && x.sh.includes(T.HL);
const sameH = (a, b) => !!a && !!b && Math.abs(a - b) <= 0.5;

// панель трека: линза, высота как в «как сейчас»
const panelChecks = async (tag, light) => {
  const T = light ? L : D;
  const srv = srvOf(MENU);
  const o = await open({ who: ANNA, srv, light });
  await home(o);
  await chip(o.page, "spg");
  const a = await panelProbe(o.page);
  await shot(o.page, (light ? "paper-" : "") + "panel-spg");
  ok(`${tag}: «Хостес» — панель раскрылась, три строки, каждая в одну строку`, !!a && /Хостес/.test(a.text) && /Открыть ›/.test(a.text) && a.lines.length === 3 && a.lines.every((h) => h <= 24), JSON.stringify(a && { t: a.text.slice(0, 90), l: a.lines }));
  ok(`${tag}: панель — карточка линзы: кромка, блик и свечение внутрь, внешней тени нет`, !!a && a.p.sh.includes(`${T.EDGE} 0px 0px 0px 1px inset`) && a.p.sh.includes(T.HL) && allInset(a.p.sh), a && a.p.sh);
  ok(`${tag}: язычок и черта под ним — золотом (как кольцо выбранного кружка)`, !!a && a.notch === (light ? "rgba(139, 106, 48, 0.6)" : "rgba(232, 201, 131, 0.72)") && /linear-gradient/.test(a.line) && a.line.includes(light ? "rgb(138, 101, 36)" : "rgb(232, 201, 131)"), JSON.stringify(a && [a.notch, a.line]));
  ok(`${tag}: «свернуть» — линза 32 px со стеклом и кольцом, в 6 px от угла`, !!a && discOk(a.x, T) && a.x.w === 32 && a.x.h === 32 && (a.x.fs === "22px" || a.x.fs === "0px") && Math.abs(a.x.t - a.pt - 6) <= 0.6 && Math.abs(a.pr - a.x.r - 6) <= 0.6, JSON.stringify(a && a.x));
  // строки уступают место: описание кончается до кольца «свернуть», заголовок — тоже
  const ringL = a ? a.x.l - 3.5 : 0;
  ok(`${tag}: первые две строки уступают место «свернуть» (текст кончается до кольца)`, !!a && a.head.pad === "44px" && a.desc.pad === "40px" && a.desc.r - 40 <= ringL && a.head.r - 44 <= ringL, JSON.stringify(a && { head: a.head, desc: a.desc, ringL }));
  const on = await onTop(o.page, "[data-track-close]");
  ok(`${tag}: «свернуть» ничем не закрыта`, on === "да", on);
  const goOk = !!a && a.go && /radial-gradient/.test(a.go.img) && a.go.color === T.INK && a.go.ring === T.PRING && a.go.rad === "999px" && a.go.pad === "3px 11px";
  ok(`${tag}: «Открыть ›» — плашка с кольцом${light ? " (подпись тёмным золотом)" : ""}`, goOk, JSON.stringify(a && a.go));
  ok(`${tag}: плашка и её кольцо — внутри панели, над нижним краем и под описанием`, !!a && a.go.r + 3.5 <= a.pr - 1 && a.go.b + 3.5 <= a.pb - 1 && a.go.t - 3.5 >= a.desc.b - 0.5, JSON.stringify(a && { go: a.go && [a.go.t, a.go.b, a.go.r], pb: a.pb, pr: a.pr, descB: a.desc && a.desc.b }));
  let low = [];
  if (light) { low = await pxAll(o.page, ["[data-track-panel] .sa-panel-in [data-track-go]"]); ok(`${tag}: «Открыть ›» читается (контраст по пикселям)`, !low.length, JSON.stringify(low)); }
  // своя роль: «твой» — стекло без рамки
  await chip(o.page, "seasonal");
  const m = await panelProbe(o.page);
  ok(`${tag}: своя роль — «твой» стеклом с ободком, своей рамки нет${light ? ", подпись тёмным золотом" : ""}`, !!m && !!m.mine && m.mine.bg === T.GLASS && m.mine.bc === "rgba(0, 0, 0, 0)" && m.mine.sh.includes(T.RIM) && (!light || m.mine.color === L.INK) && m.lines.length === 3 && m.lines.every((h) => h <= 24), JSON.stringify(m && [m.mine, m.lines]));
  if (light) { low = await pxAll(o.page, ["[data-track-panel] .sa-panel-in [data-track-mine]"]); ok(`${tag}: «твой» читается`, !low.length, JSON.stringify(low)); }
  await shot(o.page, (light ? "paper-" : "") + "panel-mine");
  // закрытый трек: замок и подсказка, без «Открыть ›»
  await chip(o.page, "core");
  const c = await panelProbe(o.page);
  ok(`${tag}: закрытый «Ядро» — замок и «Пройди «Новичок», чтобы открыть», панель линзой`, !!c && /Пройди «Новичок», чтобы открыть/.test(c.text) && !c.go && c.p.sh.includes(T.HL) && c.lines.every((h) => h <= 24), JSON.stringify(c && { t: c.text.slice(0, 80), l: c.lines }));
  // «как сейчас»: та же панель той же высоты
  const n = await open({ who: ANNA, srv: srvOf(MENU), light, seedExtra: { sa_home_look: "now" } });
  await home(n);
  const hs = [];
  for (const id of ["spg", "seasonal", "core", "bar"]) { await chip(o.page, id); await chip(n.page, id); const x = await panelProbe(o.page), y = await panelProbe(n.page); hs.push([id, x && x.h, y && y.h]); }
  ok(`${tag}: высота панели — та же, что в виде «как сейчас» (Хостес, свой, закрытый, Бар)`, hs.every(([, x, y]) => sameH(x, y)), JSON.stringify(hs));
  // «свернуть» и тап по панели
  await chip(o.page, "spg");
  await o.page.locator("[data-track-close]").click(); await sleep(800);
  const closed = await o.page.evaluate(() => !document.querySelector("[data-track-open]"));
  await chip(o.page, "spg");
  await o.page.locator("[data-track-panel]").click(); await sleep(1500);
  const opened = await o.page.evaluate(() => ({ hub: !!document.querySelector("[data-tracks-title]"), head: document.body.innerText.slice(0, 200).replace(/\s+/g, " ") }));
  ok(`${tag}: «свернуть» сворачивает, тап по панели открывает трек «Хостес»`, closed && !opened.hub && /Хостес/.test(opened.head), JSON.stringify({ closed, opened: opened.head.slice(0, 80) }));
  const [e1, e2] = noErr(o, n); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close(); await n.ctx.close();
};
await run("PANEL", () => panelChecks("PANEL", false));

// список треков: карточки, значки, ступени, «На подходе»
const listChecks = async (tag, light) => {
  const T = light ? L : D;
  const o = await open({ who: ANNA, srv: srvOf(MENU), light });
  await home(o);
  await openList(o.page);
  let s = await listProbe(o.page);
  const ids = s.cards.map((c) => c.id).join(",");
  ok(`${tag}: список — «Хостес», «Официант», «Менеджмент», «Бар» карточками линзы (кромка, блик, свет сверху)`, ids === "spg,g-waiter,g-manager,bar" && s.cards.every((c) => cardOk(c.card, T)), JSON.stringify(s.cards.map((c) => [c.id, c.card && c.card.bc, c.card && c.card.img.slice(0, 40)])));
  ok(`${tag}: значки — круглые линзы (стекло, ободок, кольцо)`, s.cards.every((c) => discOk(c.disc, T)), JSON.stringify(s.cards.map((c) => c.disc)).slice(0, 300));
  const tints = Object.fromEntries(s.cards.map((c) => [c.id, tintOf(c.disc && c.disc.sh)]));
  ok(`${tag}: оттенок роли снизу у открытых (Хостес, Официант, Бар), у закрытого «Менеджмента» — без оттенка`,
    /^rgba\(200, 145, 122, 0\.33\d*\)$/.test(tints.spg) && /^rgba\(124, 158, 135, 0\.33\d*\)$/.test(tints["g-waiter"]) && /^rgba\(200, 169, 110, 0\.33\d*\)$/.test(tints.bar) && tints["g-manager"] === "rgba(0, 0, 0, 0)", JSON.stringify(tints));
  ok(`${tag}: значки прежнего размера (30 px, без уменьшения)`, s.cards.every((c) => c.svgT === "none" && c.svgW === 30), JSON.stringify(s.cards.map((c) => [c.id, c.svgT, c.svgW])));
  const out = await ringIn(o.page, '[data-role-card] > [data-lens="disc"], [data-group-card] > [data-lens="disc"]');
  ok(`${tag}: кольца значков — в экране`, !out.length, JSON.stringify(out));
  ok(`${tag}: «На подходе» — карточки линзы, значки линзами, «скоро» стеклом без рамки`, s.soon.length === 2 && s.soon.every((x) => cardOk(x.card, T) && discOk(x.disc, T) && x.tag && x.tag.bg === T.GLASS && x.tag.bc === "rgba(0, 0, 0, 0)" && x.tag.sh.includes(T.RIM)),
    JSON.stringify(s.soon.map((x) => [x.id, x.card && x.card.bc, x.disc && x.disc.bg, x.tag && [x.tag.bg, x.tag.bc]])));
  const la = await lightAudit(o.page);
  ok(`${tag}: свет карточек не съедает подписи (${la.n} надписей)`, la.n > 10 && !la.out.length, JSON.stringify(la.out));
  await shot(o.page, (light ? "paper-" : "") + "list");
  await openGroup(o.page, "g-waiter");
  s = await listProbe(o.page);
  const st2 = s.steps.map((x) => x.id).join(",");
  ok(`${tag}: «Официант» раскрыт — ступени «Новичок» и «Ядро» с кромкой и бликом`, st2 === "seasonal,core" && s.steps.every((x) => x.card.bc === T.EDGE && x.card.sh.includes(T.HL)), JSON.stringify(s.steps.map((x) => [x.id, x.card.bc, x.card.sh.slice(0, 60)])));
  ok(`${tag}: номера ступеней — линзы: стекло на плотном тоне, без своей рамки, с кольцом`,
    s.steps.length === 2 && s.steps.every((x) => x.num && /radial-gradient/.test(x.num.img) && x.num.bg === (light ? "rgb(244, 234, 211)" : "rgb(28, 22, 12)") && x.num.bc === "rgba(0, 0, 0, 0)" && x.num.ring === T.RING && x.num.sh.includes(T.RIM)),
    JSON.stringify(s.steps.map((x) => x.num)).slice(0, 400));
  ok(`${tag}: кольца номеров не срезаны краем раскрытого списка`, s.steps.every((x) => x.num.l - 3.5 >= x.subL - 0.5 && x.num.t - 3.5 >= x.subT - 0.5 && x.num.b + 3.5 <= x.subB + 0.5), JSON.stringify(s.steps.map((x) => [x.num.l, x.subL, x.num.t, x.subT, x.num.b, x.subB])));
  if (light) {
    const low = await pxAll(o.page, ['[data-step-card="seasonal"] .sa-stepnum', await pick(o.page, '[data-role-card="spg"] div', "Служба приёма гостей"), await pick(o.page, '[data-group-card="g-waiter"] div', "От базовых стандартов")]);
    ok(`${tag}: номер ступени и подписи карточек читаются (контраст по пикселям)`, !low.length, JSON.stringify(low));
  }
  await shot(o.page, (light ? "paper-" : "") + "list-steps");
  // тап по роли и по ступени по-прежнему открывает трек
  await o.page.locator('[data-step-card="seasonal"]').click(); await sleep(1500);
  const t1 = await o.page.evaluate(() => ({ hub: !!document.querySelector("[data-tracks-title]"), head: document.body.innerText.slice(0, 200).replace(/\s+/g, " ") }));
  ok(`${tag}: тап по ступени «Новичок» открывает трек`, !t1.hub && /Новичок/.test(t1.head), t1.head.slice(0, 80));
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LIST", () => listChecks("LIST", false));
await run("PAPER", async () => { await panelChecks("PAPER", true); await listChecks("PAPER", true); });

await run("NOW", async () => {
  const o = await open({ who: ANNA, srv: srvOf(MENU), seedExtra: { sa_home_look: "now" } });
  await home(o);
  await chip(o.page, "spg");
  const a = await panelProbe(o.page);
  ok("NOW: «как сейчас» — панель прежняя: «свернуть» 22 px в 8 px от угла, «Открыть ›» без плашки, кромка цвета роли",
    !!a && a.x.w === 22 && Math.abs(a.x.t - a.pt - 8) <= 0.6 && a.go.img === "none" && !a.go.ring && a.go.pad === "0px" && a.p.sh.startsWith("rgba(200, 145, 122, 0.35) 0px 0px 0px 1px inset") && a.head.pad === "28px" && a.notch === "rgba(200, 145, 122, 0.667)",
    JSON.stringify(a && { x: a.x, go: a.go, sh: a.p.sh, pad: a.head.pad, notch: a.notch }));
  await shot(o.page, "now-panel");
  await chip(o.page, "spg");
  await openList(o.page);
  await openGroup(o.page, "g-waiter");
  const s = await listProbe(o.page);
  const nowBad = [
    ...s.cards.filter((c) => c.card.bc === EDGE || /radial-gradient/.test(c.card.img) || c.disc.ring || c.disc.bg === GLASS).map((c) => "карточка " + c.id + ": " + JSON.stringify([c.card.bc, c.card.img.slice(0, 50), c.disc.ring, c.disc.bg])),
    ...s.steps.filter((x) => x.num.bc !== (/locked/.test(x.cls) ? "rgba(255, 255, 255, 0.22)" : "rgb(226, 186, 116)") || x.num.ring).map((x) => "ступень " + x.id + ": " + JSON.stringify([x.num.bc, x.num.ring])),
    ...s.soon.filter((x) => x.tag.bc === "rgba(0, 0, 0, 0)" || x.disc.ring).map((x) => "скоро " + x.id + ": " + JSON.stringify([x.tag.bc, x.disc.ring])),
  ];
  ok("NOW: список прежний — кромка цвета роли, значки без кольца, номера ступеней в золотой рамке",
    s.cards.length === 4 && s.steps.length === 2 && s.soon.length === 2 && !nowBad.length, JSON.stringify({ n: [s.cards.length, s.steps.length, s.soon.length], nowBad }));
  await shot(o.page, "now-list");
  const [e1, e2] = noErr(o); ok("NOW: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("WIDE", async () => {
  const o = await open({ who: ANNA, srv: srvOf(MENU), w: 1180, h: 820, mobile: false });
  await hideToasts(o.page); await until(() => o.page.locator("[data-role-card]").count(), 9000); await sleep(800);
  const s = await listProbe(o.page);
  const two = await o.page.evaluate(() => !!document.querySelector("[data-home2-title]"));
  ok("WIDE: две колонки — список треков справа карточками линзы, значки линзами", two && s.cards.length === 4 && s.cards.every((c) => cardOk(c.card, D) && discOk(c.disc, D)), JSON.stringify({ two, n: s.cards.length, c: s.cards[0] && s.cards[0].card.bc }));
  await shot(o.page, "wide");
  const [e1, e2] = noErr(o); ok("WIDE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("NARROW", async () => {
  for (const [w, h] of [[360, 740], [320, 640]]) {
    const o = await open({ who: ANNA, srv: srvOf(MENU), w, h });
    await home(o);
    const bad = [];
    for (const id of ["spg", "seasonal", "bar", "core"]) {
      await chip(o.page, id);
      const a = await panelProbe(o.page);
      if (!a) { bad.push(id + ": нет панели"); continue; }
      if (!(a.lines.length === 3 && a.lines.every((x) => x <= 24))) bad.push(id + ": строки " + a.lines.join("/"));
      if (a.row3 && a.row3.over > 0.5) bad.push(id + ": третья строка шире панели на " + a.row3.over.toFixed(1));
      if (a.go && !(a.go.r + 3.5 <= a.pr - 1)) bad.push(id + ": кольцо плашки за краем " + a.go.r + "/" + a.pr);
      if (a.desc.r - 40 > a.x.l - 3.5) bad.push(id + ": описание под «свернуть»");
    }
    const f = await fits(o.page);
    await shot(o.page, "narrow-" + w);
    ok(`NARROW ${w}: панели «Хостес», своя, «Бар», «Ядро» — по строке, плашка и кольца в панели, без сдвига вбок`, !bad.length && f.sw <= f.W, JSON.stringify([bad, f]));
    await o.ctx.close();
  }
});

// ряд ответа AI-интервью. Владелец (31.10, снимок): «В AI HR увидел неровность. Ответ голосом съехал вниз»
const COMPS = ["Сервис и гость", "Конфликты и сложные ситуации", "Приоритеты и организация", "Честность и деньги", "Команда"];
const HELLO = "Здравствуйте, Мария! Очень рада знакомству. Представьте: гость долго сидит над меню и говорит: «Даже не знаю, всё какое-то непонятное». Что вы сделаете?";
const btnT = (page, t) => page.locator("button", { hasText: t }).first();
async function toAi(o) {
  await o.ctx.route("**/functions/v1/ai-hr", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, v: 2, reply: HELLO, topic: 0, followup: false, done: false, topics: COMPS, total: 5, model: "test" }) }));
  await nav(o.page, "candidate", 1300);
  await btnT(o.page, "Начать собеседование").click(); await sleep(450);
  await o.page.locator('input[placeholder="Имя кандидата"]').fill("Мария"); await sleep(120);
  await btnT(o.page, "Дальше: анкета опыта").click(); await sleep(450);
  await o.page.locator(".sa-btn", { hasText: "До года" }).first().click(); await sleep(150);
  await btnT(o.page, /^Дальше$/).click(); await sleep(450);
  await btnT(o.page, /^AI-интервью/).click();
  await o.page.waitForFunction(() => document.body.innerText.includes("Здравствуйте, Мария"), null, { timeout: 8000 }).catch(() => {});
  await sleep(500);
}
const hrRow = (page) => page.evaluate(() => {
  const row = document.querySelector("[data-hr-inrow]"); if (!row) return null;
  const b = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: +r.left.toFixed(2), r: +r.right.toFixed(2), t: +r.top.toFixed(2), b: +r.bottom.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), cy: +((r.top + r.bottom) / 2).toFixed(2) }; };
  const ta = row.querySelector("textarea"), mic = row.querySelector('button[aria-label="Сказать голосом"]'), talk = row.querySelector("[data-talk-open]");
  const send = [...row.querySelectorAll("button")].find((x) => x.querySelector("svg path[d='M22 2L11 13']"));
  const ring = (e) => (e ? !["none", "normal"].includes(getComputedStyle(e, "::after").content) : false);
  // лента переписки — карточка над рядом (её правый край — край колонки)
  let feed = document.querySelector(".sa-dlgscroll"); while (feed && feed.parentElement && feed.getBoundingClientRect().width < row.getBoundingClientRect().width - 1) feed = feed.parentElement;
  return { row: b(row), ta: b(ta), mic: b(mic), talk: b(talk), send: b(send), feed: b(feed), micRing: ring(mic), talkRing: ring(talk), gap: getComputedStyle(row).columnGap, pr: getComputedStyle(row).paddingRight };
});
const near = (a, b, d = 0.6) => a != null && b != null && Math.abs(a - b) <= d;
await run("HR", async () => {
  for (const [tag, light, look] of [["HR", false, ""], ["HR PAPER", true, ""], ["HR NOW", false, "now"]]) {
    const o = await open({ who: MARIA, srv: srvOf(MENU), light, seedExtra: look ? { sa_home_look: look } : {} });
    await hideToasts(o.page);
    await toAi(o);
    let g = await hrRow(o.page);
    await shot(o.page, "hr-" + (light ? "paper" : look || "lens"));
    ok(`${tag}: ряд ответа на месте — поле, микрофон и волна «Отвечать голосом»`, !!g && !!g.ta && !!g.mic && !!g.talk, JSON.stringify(g));
    if (!g || !g.talk) { await o.ctx.close(); continue; }
    ok(`${tag}: микрофон и волна — одного размера (46 px), их центры на линии центра поля (было: волна ниже на 3 px, микрофон выше на 2)`,
      g.mic.h === 46 && g.talk.h === 46 && near(g.mic.cy, g.ta.cy) && near(g.talk.cy, g.ta.cy), JSON.stringify({ ta: g.ta.cy, mic: [g.mic.cy, g.mic.h], talk: [g.talk.cy, g.talk.h] }));
    if (!look) {
      const between = (g.talk.l - 3.5) - (g.mic.r + 3.5), right = g.row.r - (g.talk.r + 3.5), left = (g.mic.l - 3.5) - g.ta.r;
      ok(`${tag}: в «Линзе» кольца не сходятся (между ними ${between.toFixed(1)} px), кольцо волны не выходит за край ленты`,
        g.micRing && g.talkRing && g.gap === "12px" && g.pr === "4px" && between >= 4 && left >= 4 && right >= 0 && (!g.feed || g.talk.r + 3.5 <= g.feed.r + 0.01),
        JSON.stringify({ between, left, right, feed: g.feed && g.feed.r, talkR: g.talk.r, gap: g.gap, pr: g.pr }));
    } else {
      ok(`${tag}: «как сейчас» — без колец и прежних промежутков (8 px, волна у правого края)`, !g.micRing && !g.talkRing && g.gap === "8px" && g.pr === "0px" && near(g.talk.r, g.row.r, 0.01), JSON.stringify({ gap: g.gap, pr: g.pr, talkR: g.talk.r, rowR: g.row.r }));
    }
    // набрал ответ — «Отправить» на месте волны, на той же линии; три строки — кнопки у последней строки
    await o.page.locator('textarea[placeholder="Ответ кандидата…"]').fill("Предложу помощь");
    await o.page.locator('textarea[placeholder="Ответ кандидата…"]').dispatchEvent("input"); await sleep(300);
    g = await hrRow(o.page);
    ok(`${tag}: набрал текст — «Отправить» на месте волны, по той же линии`, !!g && !!g.send && !g.talk && near(g.send.cy, g.ta.cy) && near(g.mic.cy, g.ta.cy), JSON.stringify(g && { ta: g.ta, send: g.send, mic: g.mic }));
    await o.page.locator('textarea[placeholder="Ответ кандидата…"]').fill("Подойду к гостю.\nСпрошу, что он любит.\nПредложу два блюда на выбор.");
    await o.page.locator('textarea[placeholder="Ответ кандидата…"]').dispatchEvent("input"); await sleep(300);
    g = await hrRow(o.page);
    ok(`${tag}: ответ в три строки — поле растёт вверх, микрофон и «Отправить» у последней строки`, !!g && g.ta.h > 70 && near(g.send.b, g.ta.b - 1) && near(g.mic.b, g.ta.b - 1), JSON.stringify(g && { ta: g.ta, send: g.send, mic: g.mic }));
    await shot(o.page, "hr-3lines-" + (light ? "paper" : look || "lens"));
    const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
    await o.ctx.close();
  }
});

// чёрный текст по умолчанию: цвет нигде не задан — на тёмной теме его не видно. Владелец (31.10, снимок «Новички»):
// «В вкладке новички, текст на тёмной теме чёрный»
function srvEmpty(menu = MENU) {
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu,
    progress: {}, quizzes: {}, tgLinked: [], newbies: [], nbMemo: MEMO, cands: [], cheers: false, activity: {}, quiz: [], thanks: [], peerThanks: [], learn: {}, ping: () => {} });
  s.calls = []; s.pings = [];
  return s;
}
const blackText = (page) => page.evaluate(() => {
  const out = []; const seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t.length < 2) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (el.closest("svg, style, script, noscript, select, option")) continue;
    if (getComputedStyle(el).color !== "rgb(0, 0, 0)") continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let v = el, hid = false; while (v && v !== document.body) { const s = getComputedStyle(v); if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) { hid = true; break; } v = v.parentElement; }
    if (!hid) out.push(t.slice(0, 50));
  }
  return out;
});
await run("INK", async () => {
  for (const [look, tag] of [["", "INK"], ["now", "INK NOW"]]) {
    const seedExtra = look ? { sa_home_look: look } : {};
    const m = await open({ who: MARIA, srv: srvEmpty(), seedExtra });
    await hideToasts(m.page);
    await nav(m.page, "newbies", 2200);
    const e = await st(m.page, "[data-nbl-empty]");
    const b1 = await blackText(m.page);
    await shot(m.page, "ink-newbies-" + (look || "lens"));
    const fs = await m.page.evaluate(() => { const x = document.querySelector("[data-nbl-empty]"); return x ? getComputedStyle(x).fontSize : null; });
    ok(`${tag}: «Новички» без новичков — текст карточки цветом строк экрана (14 px), не чёрный`, !!e && e.color === "rgb(240, 232, 216)" && fs === "14px" && !b1.length, JSON.stringify({ e: e && [e.color], fs, b1 }));
    await m.ctx.close();
    // Анна никого не ведёт: «Сейчас ты никого не ведёшь…» — та же карточка
    const a = await open({ who: ANNA, srv: srvOf(MENU), seedExtra });
    await hideToasts(a.page);
    await nav(a.page, "newbies", 2200);
    const n = await st(a.page, "[data-nbl-empty]");
    const t2 = await txt(a.page.locator("[data-nbl-empty]"));
    const b2 = await blackText(a.page);
    ok(`${tag}: «Новички» у наставника без подопечных — «Сейчас ты никого не ведёшь…» цветом строк экрана`, !!n && n.color === "rgb(240, 232, 216)" && /никого не ведёшь/.test(t2) && !b2.length, JSON.stringify({ n: n && n.color, t2, b2 }));
    await a.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
