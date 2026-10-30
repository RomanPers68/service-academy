// e2e v115 (Доп. 428): «Учусь» в линзах. Владелец (30.10): «Пройдёмся по приложению, добьём то, что осталось? Чтобы
// приложение визуально было едино». В виде «Линза» (по умолчанию). Сервер — tools/claude/demo-app/fake-server.js. Разделы:
//   TRACK  — трек: «Дальше» текущего шага — плашка с кольцом, надпись золотом;
//   TABLE  — практика у стола (оболочка .tb-table): «закрыть», значок, инструменты — линзы с кольцом (инструменты круглые),
//            ответы — стекло, после ответа «Дальше» — плашка с кольцом;
//   QUIZ   — тест: ответы — стекло; после ответа верный — прежний зелёный, ответ не стеклянный; правило зачёта — кромка;
//   LEARN  — «Погреб тем» (плашка, стекло, выбранный фильтр — плашка), «Путь мастера» («Сделать ›» — плашка, значки —
//            линзы, главная награда — кромка и свой градиент), сертификаты, путеводитель, поиск и «Справочник»;
//   PAPER  — «Для чтения»: тёмное золото у плашек и линз, ответы теста — светлое стекло; буквы ответов и «Дальше» трека —
//            контраст по пикселям не ниже нормы;
//   NOW    — вид «как сейчас»: трек, урок у стола, тест и «Погреб тем» прежние;
//   NARROW — 320 px: кольца и плашки в экране.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v115.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v115";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v115";
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

const strip1 = (page) => page.evaluate(() => { const b = [...document.querySelectorAll(".tbp-num")].find((x) => x.textContent.trim() === "1"); if (b) b.click(); });
const openCur = (page) => page.evaluate(() => { const e = [...document.querySelectorAll(".tbm-node.tbm-cur")].find((x) => x.offsetParent !== null); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } return !!e; });
const openRow = (page, prefix) => page.evaluate((p) => { const e = [...document.querySelectorAll("button.tbm-node")].find((x) => x.offsetParent !== null && (x.getAttribute("aria-label") || "").startsWith(p)); if (e) { e.scrollIntoView({ block: "center" }); e.click(); } return !!e; }, prefix);
const toPractice = async (page) => { await nav(page, "home", 2200); await openCur(page); return until(() => page.locator(".tb-table .tb-x").count(), 9000); };
const toQuiz = async (page) => { await nav(page, "home", 2200); await strip1(page); await sleep(900); await openRow(page, "Тест: мышление"); return until(() => page.locator("[data-quiz-opt]").count(), 9000); };
const answerTable = (page) => page.evaluate(() => { const o = [...document.querySelectorAll(".tb-table .tb-chip2,.tb-table .tb-actc,.tb-table .tb-reply,.tb-table .tb-myth button")].filter((x) => x.offsetParent !== null)[0]; if (o) o.click(); return !!o; });
const optSel = ".tb-table .tb-chip2, .tb-table .tb-actc, .tb-table .tb-myth button";

await run("TRACK", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "home", 2200);
  const c = await st(a.page, ".tbm-cur .tbm-cta");
  ok("TRACK: «Дальше» текущего шага — плашка с кольцом, надпись золотом", !!c && /radial-gradient/.test(c.img) && c.color === HI && c.ring === RING && c.sh.includes(RIM), JSON.stringify(c));
  ok("TRACK: кольцо «Дальше» не закрывает соседей (шаг нажимается)", (await onTop(a.page, ".tbm-cur .tbm-cta")) === "да");
  await shot(a.page, "track");
  const [e1, e2] = noErr(a); ok("TRACK: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("TABLE", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  ok("TABLE: практика у стола открылась — оболочка .tb-table", !!(await toPractice(a.page)) && (await a.page.evaluate(() => (document.querySelector(".tb") || {}).className)) === "tb tb-table");
  await sleep(500);
  const x = await st(a.page, ".tb-table .tb-x"), av = await st(a.page, ".tb-table .tb-av"), tl = await st(a.page, ".tb-table .tb-tool");
  ok("TABLE: «закрыть», значок, инструменты — линзы с кольцом, значки золотом", isDisc(x) && x.color === GOLD_L && isDisc(av) && isDisc(tl) && tl.rad === "50%", JSON.stringify([x, av, tl]));
  await until(() => a.page.evaluate((sel) => [...document.querySelectorAll(sel)].some((x) => x.offsetParent !== null), optSel), 9000);
  const o = await st(a.page, optSel);
  ok("TABLE: ответы — стекло с ободком и бликом", !!o && o.bg === GLASS && o.sh.includes(RIM) && o.sh.includes(HL), JSON.stringify(o));
  await shot(a.page, "table");
  await answerTable(a.page); await sleep(1400);
  const m = await st(a.page, ".tb-table .tb-main");
  ok("TABLE: после ответа «Дальше» — плашка с кольцом", !!m && /radial-gradient/.test(m.img) && m.color === HI && m.ring === RING, JSON.stringify(m));
  await shot(a.page, "table-answer");
  const [e1, e2] = noErr(a); ok("TABLE: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("QUIZ", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  ok("QUIZ: тест открылся", !!(await toQuiz(a.page)));
  await sleep(500);
  const o = await st(a.page, '[data-quiz-opt="0"]'), r = await st(a.page, "[data-quiz-rule]");
  ok("QUIZ: ответы — стекло с ободком; правило зачёта — кромка", !!o && o.bg === GLASS && o.sh.includes(RIM) && isEdge(r), JSON.stringify([o, r]));
  await a.page.locator('[data-quiz-opt="0"]').click(); await sleep(300);
  const marks = await a.page.evaluate(() => [...document.querySelectorAll("[data-quiz-opt]")].map((e) => e.getAttribute("data-lens-opt") + "|" + getComputedStyle(e).backgroundColor));
  ok("QUIZ: после ответа верный — прежний зелёный (не стекло), неверный — прежний красный", marks.some((m) => m === "ok|rgba(93, 187, 138, 0.15)") && marks.every((m) => !/^(ok|bad)\|rgba\(200, 169, 110, 0\.12\)/.test(m)), marks.join(" · "));
  await shot(a.page, "quiz");
  const [e1, e2] = noErr(a); ok("QUIZ: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("LEARN", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "cellar", 2200);
  const probe = await st(a.page, await pick(a.page, "button", "Проверка по треку")), all = await st(a.page, '[aria-pressed="true"]'), act = await st(a.page, "[data-cellar-action]");
  const sum = await st(a.page, '[aria-label="Сводка"]');
  ok("LEARN: «Погреб тем» — сводка карточкой, «Проверка по треку» — стекло, выбранный фильтр — плашка, кнопка темы — плашка или стекло",
    lensCard(sum) && isSoft(probe) && isTab(all) && !!act && (isSoft(act) || /radial-gradient/.test(act.img)), JSON.stringify([sum, probe, all, act]));
  await shot(a.page, "cellar");
  await nav(a.page, "mastery", 2200);
  const go = await st(a.page, await pick(a.page, "button", "Сделать")), hero = await st(a.page, "[data-ms-hero]"), gl = await st(a.page, '[data-ms-step] [data-lens="glyph"]');
  ok("LEARN: «Путь мастера» — «Сделать ›» плашка с кольцом, главная награда — кромка и свой градиент, значок шага — линза",
    (isMain(go) || go === null) && !!hero && hero.bc === EDGE && /linear-gradient/.test(hero.img) && !!gl && gl.ring !== "", JSON.stringify([go, hero, gl]));
  await shot(a.page, "mastery");
  await nav(a.page, "certificates", 1800);
  const cert = await st(a.page, "[data-lens-card]");
  ok("LEARN: сертификаты — карточки линзы", lensCard(cert), JSON.stringify(cert));
  await nav(a.page, "guide", 1800);
  const g = await st(a.page, "[data-lens-card]");
  ok("LEARN: путеводитель — пункты карточками линзы", lensCard(g), JSON.stringify(g));
  await nav(a.page, "search", 1500);
  const s = await st(a.page, 'input[placeholder^="Блюдо, аллерген"]');
  await nav(a.page, "reference", 1800);
  const rf = await st(a.page, '[role="search"]');
  ok("LEARN: поиск и поиск по «Справочнику» — стекло с ободком", !!s && s.bg === GLASS && !!rf && rf.bg === GLASS && rf.sh.includes(RIM), JSON.stringify([s, rf]));
  const [e1, e2] = noErr(a); ok("LEARN: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const HI_L = "rgb(107, 78, 26)";
  const a = await open({ who: ANNA, srv, light: true });
  await nav(a.page, "home", 2200);
  const c = await st(a.page, ".tbm-cur .tbm-cta");
  ok("PAPER: «Дальше» трека — светлая плашка, тёмное золото", !!c && c.color === HI_L && c.img.includes("rgba(255, 255, 255, 0.85)") && c.ring === "rgba(139, 106, 48, 0.45)", JSON.stringify(c));
  const cr = await pxRatio(a.page, ".tbm-cur .tbm-cta");
  await toQuiz(a.page); await sleep(500);
  const o = await st(a.page, '[data-quiz-opt="0"]');
  ok("PAPER: ответ теста — светлое стекло", !!o && o.bg === "rgba(255, 255, 255, 0.55)", JSON.stringify(o));
  const lr = await pxRatio(a.page, '[data-quiz-opt="0"] > span:first-child');
  ok("PAPER: контраст по пикселям — буква ответа и «Дальше» трека не ниже нормы", !!lr && lr.r >= lr.need && !!cr && cr.r >= cr.need, JSON.stringify([lr, cr]));
  await shot(a.page, "paper-quiz");
  const b = await open({ who: ANNA, srv, light: true });
  await toPractice(b.page); await sleep(500);
  const tl = await st(b.page, ".tb-table .tb-tool");
  ok("PAPER: инструменты урока у стола — светлая линза, значок тёмным золотом", !!tl && tl.bg === "rgba(139, 106, 48, 0.09)" && tl.color === HI_L, JSON.stringify(tl));
  const [e1, e2] = noErr(a, b); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, seedExtra: { sa_home_look: "now" } });
  await nav(a.page, "home", 2200);
  const c = await st(a.page, ".tbm-cur .tbm-cta");
  ok("NOW: «Дальше» трека — прежнее золото без кольца", !!c && /linear-gradient/.test(c.img) && !c.ring, JSON.stringify(c));
  await toPractice(a.page); await sleep(500);
  const x = await st(a.page, ".tb-table .tb-x"), tl = await st(a.page, ".tb-table .tb-tool");
  ok("NOW: урок у стола — «закрыть» и инструменты прежние (без колец, инструменты — скруглённые квадраты)", !!x && !x.ring && !!tl && tl.rad === "10px" && !tl.ring, JSON.stringify([x, tl]));
  const b = await open({ who: ANNA, srv, seedExtra: { sa_home_look: "now" } });
  await toQuiz(b.page); await sleep(500);
  const o = await st(b.page, '[data-quiz-opt="0"]');
  ok("NOW: ответы теста — прежние (не стекло линзы)", !!o && o.bg !== GLASS, JSON.stringify(o));
  const [e1, e2] = noErr(a, b); ok("NOW: без ошибок", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, w: 320, h: 700 });
  await toPractice(a.page); await sleep(600);
  const f = await a.page.evaluate(() => { const W = document.documentElement.clientWidth; const bad = [...document.querySelectorAll(".tb-table .tb-x,.tb-table .tb-av,.tb-table .tb-tool")]
    .filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left - 3.5, r: r.right + 3.5 }; });
    return { W, sw: document.documentElement.scrollWidth, n: bad.length, bad: bad.filter((x) => x.l < 0 || x.r > W) }; });
  ok("NARROW: 320 px — урок у стола без сдвига вбок, кольца в экране", f.n >= 3 && f.sw <= f.W && !f.bad.length, JSON.stringify(f));
  await nav(a.page, "home", 2200);
  const t = await a.page.evaluate(() => { const W = document.documentElement.clientWidth; const e = document.querySelector(".tbm-cur .tbm-cta"); if (!e) return null; const r = e.getBoundingClientRect(); return { W, l: r.left - 3.5, r: r.right + 3.5 }; });
  ok("NARROW: 320 px — кольцо «Дальше» трека в экране", !!t && t.l >= 0 && t.r <= t.W, JSON.stringify(t));
  await shot(a.page, "narrow");
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
