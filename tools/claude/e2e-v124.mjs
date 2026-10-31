// e2e v124 (Доп. 437): «Редактор вин» удобнее и красивее; «Вино к блюду», «Опиши за 60 секунд», «Как произносить».
// Владелец (31.10): «И так же, как мы сам редактор можем сделать более удобнее и красивее?». Сервер и карта — как в e2e-v123
// (fake-server; шесть живых вин, два — с полями от AI, одно — в архиве; у «Просекко» и «Шабли» отмечены блюда). Разделы:
//   SUMMARY — сводка над кнопками: сколько вин, «проверено N из M», «Проверка подряд», «Что дописать» — фильтр списка;
//   PARTS   — форма по разделам с «заполнено N из M», цвет перед сортом;  HINTS — подсказки страны, региона, сорта;
//   NEXT    — «Сохранить и дальше» по списку; форма сверху, список — на том же месте;
//   PAIR    — «Вино к блюду»;  SAY60 — «Опиши за 60 секунд»;  PRON — «Как произносить» на обороте и словарь «Наша карта»;
//   LENS, PAPER — линза и «Для чтения», контраст; NOW — вид «как сейчас»; NARROW — 320 px.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v124.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v124";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v124";
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

// ── v124: редактор удобнее и красивее; «Вино к блюду», «Опиши за 60 секунд», «Как произносить» ──
const { gapCounts, GAPS } = await import(SRC + "/lib/wine.js");
const { describePoints, dishPairs } = await import(SRC + "/lib/wine-train.js");
const rootTop = (page) => page.evaluate(() => document.getElementById("root").scrollTop);
const back = async (page) => { await page.locator('[data-lens="back"]').first().click(); await sleep(700); };
const rowsShown = (page) => page.evaluate(() => [...document.querySelectorAll("[data-wine-erow]")].map((e) => e.getAttribute("data-wine-erow")));
const live = T_WINES.filter((w) => !w.archived);

await run("SUMMARY", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toEditor(o.page);
  const gc = gapCounts(T_WINES);
  const s = await o.page.evaluate(() => ({ line: (document.querySelector("[data-wine-sum-line]") || {}).textContent || "", checked: (document.querySelector("[data-wine-checked]") || { getAttribute: () => "" }).getAttribute("data-wine-checked"),
    rev: (document.querySelector("[data-wine-sum-card] [data-wine-review-start]") || {}).textContent || "", gaps: [...document.querySelectorAll("[data-wine-gap]")].map((e) => e.getAttribute("data-wine-gap") + "=" + e.textContent.trim()),
    order: (() => { const a = document.querySelector("[data-wine-sum-card]"), b = document.querySelector("[data-wine-new]"); return a && b ? a.getBoundingClientRect().bottom <= b.getBoundingClientRect().top : false; })() }));
  const want = GAPS.filter(([k]) => gc[k]).map(([k, t]) => k + "=" + t + " · " + gc[k]);
  ok("SUMMARY: сводка над кнопками — сколько вин, «проверено 4 из 6», «Проверка подряд · 2», «Что дописать» с числами", s.line === "6 вин · бокалом 3 · в архиве 1" && s.checked === "4/6" && s.rev === "Проверка подряд · 2" && s.order && JSON.stringify(s.gaps) === JSON.stringify(want), JSON.stringify({ s, want }));
  await shot(o.page, "summary");
  await o.page.locator('[data-wine-gap="noshort"]').click(); await sleep(400);
  const shownIds = await rowsShown(o.page), chip = await o.page.evaluate(() => ({ on: document.querySelector('[data-wine-gap="noshort"]').getAttribute("aria-pressed"), filt: (document.querySelector('[data-wine-filter="noshort"]') || {}).textContent || "" }));
  const expectIds = live.filter((w) => !w.short).map((w) => w.id).sort();
  ok("SUMMARY: «Без фразы гостю» — в списке ровно эти вина, чип нажат и виден в ряду фильтров", JSON.stringify(shownIds.slice().sort()) === JSON.stringify(expectIds) && chip.on === "true" && /^Без фразы гостю · \d+$/.test(chip.filt), JSON.stringify({ shownIds, expectIds, chip }));
  await o.page.locator('[data-wine-gap="noshort"]').click(); await sleep(400);
  ok("SUMMARY: второе касание — снова все", (await rowsShown(o.page)).length === live.length && (await o.page.locator('[data-wine-filter="all"]').getAttribute("aria-pressed")) === "true");
  const [e1, e2] = noErr(o); ok("SUMMARY: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("PARTS", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator('[data-wine-erow="w-chi"] [role="button"]').click(); await sleep(600);
  const p = await o.page.evaluate(() => ({ parts: [...document.querySelectorAll("[data-wine-part]")].map((e) => e.getAttribute("data-wine-part") + ":" + e.querySelector("[data-wine-part-fill]").textContent.trim()),
    colorFirst: (() => { const c = document.querySelector("[data-wine-color]"), g = document.querySelector('[data-wine-field="grapes"]'); return c && g ? c.getBoundingClientRect().top < g.getBoundingClientRect().top : null; })() }));
  ok("PARTS: форма по разделам — «Откуда и какое», «Подача и цена», «Как рассказать гостю», «К блюдам» со «заполнено N из M»; цвет — перед сортом",
    p.parts.join("|") === "origin:заполнено 5 из 7|serve:заполнено 1 из 4|guest:заполнено 0 из 3|pair:не отмечено" && p.colorFirst === true, JSON.stringify(p));
  await o.page.locator('[data-wine-field="short"]').fill("Вишня, специи и бодрая кислотность."); await sleep(200);
  const g2 = await o.page.evaluate(() => document.querySelector('[data-wine-part="guest"] [data-wine-part-fill]').textContent.trim());
  ok("PARTS: вписал фразу гостю — «заполнено 1 из 3» сразу", g2 === "заполнено 1 из 3", g2);
  await shot(o.page, "parts");
  const [e1, e2] = noErr(o); ok("PARTS: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("HINTS", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator("[data-wine-new]").click(); await sleep(500);
  const h0 = await o.page.evaluate(() => [...document.querySelectorAll('[data-wine-hints="country"] [data-wine-hint]')].map((e) => e.textContent));
  ok("HINTS: пустая страна — подсказки: сначала страны своей карты", h0.slice(0, 2).sort().join(",") === "Италия,Франция" && h0.includes("Испания") && h0.length <= 8, JSON.stringify(h0));
  await o.page.locator('[data-wine-hints="country"] [data-wine-hint="Франция"]').click(); await sleep(250);
  const h1 = await o.page.evaluate(() => ({ c: document.querySelector('[data-wine-field="country"]').value, reg: [...document.querySelectorAll('[data-wine-hints="region"] [data-wine-hint]')].map((e) => e.textContent), cRow: !!document.querySelector('[data-wine-hints="country"]') }));
  ok("HINTS: «Франция» — вписана; теперь регионы Франции: сначала из своей карты («Бургундия»)", h1.c === "Франция" && h1.reg[0] === "Бургундия" && h1.reg.includes("Прованс") && h1.reg.includes("Бордо") && !h1.cRow, JSON.stringify(h1));
  await o.page.locator('[data-wine-hints="region"] [data-wine-hint="Бургундия"]').click(); await sleep(250);
  await o.page.locator('[data-wine-color="white"]').click(); await sleep(250);
  const h2 = await o.page.evaluate(() => ({ r: document.querySelector('[data-wine-field="region"]').value, reg: !!document.querySelector('[data-wine-hints="region"]'), g: [...document.querySelectorAll('[data-wine-hints="grapes"] [data-wine-hint]')].map((e) => e.textContent) }));
  ok("HINTS: регион вписан, подсказки региона ушли; белое — сорта белых, сначала из своей карты", h2.r === "Бургундия" && !h2.reg && h2.g[0] === "шардоне" && h2.g.includes("совиньон блан") && !h2.g.includes("санджовезе"), JSON.stringify(h2));
  await o.page.locator('[data-wine-hints="grapes"] [data-wine-hint="шардоне"]').click(); await sleep(250);
  const h3 = await o.page.evaluate(() => ({ g: document.querySelector('[data-wine-field="grapes"]').value, row: !!document.querySelector('[data-wine-hints="grapes"]'), fill: document.querySelector('[data-wine-part="origin"] [data-wine-part-fill]').textContent.trim() }));
  ok("HINTS: сорт вписан, подсказки сорта ушли; раздел — «заполнено 4 из 7»", h3.g === "шардоне" && !h3.row && h3.fill === "заполнено 4 из 7", JSON.stringify(h3));
  await shot(o.page, "hints");
  const [e1, e2] = noErr(o); ok("HINTS: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("NEXT", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T });
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator('[data-wine-gap="noshort"]').click(); await sleep(400);
  const ids = await rowsShown(o.page);
  await o.page.locator(`[data-wine-erow="${ids[0]}"] [role="button"]`).click(); await sleep(600);
  const f0 = await o.page.evaluate(() => ({ form: document.querySelector("[data-wine-form]").getAttribute("data-wine-form"), next: (document.querySelector("[data-wine-save-next]") || { getAttribute: () => null }).getAttribute("data-wine-save-next"),
    nextT: (document.querySelector("[data-wine-save-next]") || {}).textContent || "", save: (document.querySelector("[data-wine-save]") || {}).textContent || "" }));
  ok("NEXT: форма из списка «Без фразы гостю» — «Сохранить» и «Сохранить и дальше ›» к следующему вину того же списка", ids.length === 3 && f0.form === ids[0] && f0.next === ids[1] && f0.nextT === "Сохранить и дальше ›" && f0.save === "Сохранить", JSON.stringify({ f0, ids }));
  await o.page.locator('[data-wine-field="short"]').fill("Фраза для первого вина."); await sleep(150);
  await o.page.locator("[data-wine-save-next]").click(); await sleep(1500);
  const f1 = await o.page.evaluate(() => ({ form: (document.querySelector("[data-wine-form]") || { getAttribute: () => null }).getAttribute("data-wine-form"), top: document.getElementById("root").scrollTop, short: document.querySelector('[data-wine-field="short"]').value }));
  const saved = wines(srv).find((x) => x.id === ids[0]);
  ok("NEXT: «Сохранить и дальше» — сохранено у всех, сразу форма следующего вина (сверху, со своими полями)", saved.short === "Фраза для первого вина." && f1.form === ids[1] && f1.top === 0 && f1.short === "", JSON.stringify({ f1, short: saved.short }));
  await o.page.locator("[data-wine-save-next]").click(); await sleep(1500);
  const last = await o.page.evaluate(() => ({ form: document.querySelector("[data-wine-form]").getAttribute("data-wine-form"), next: !!document.querySelector("[data-wine-save-next]"), cancel: [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Отмена") }));
  ok("NEXT: последнее вино списка — «Отмена» и «Сохранить», без «дальше»", last.form === ids[2] && !last.next && last.cancel, JSON.stringify(last));
  await back(o.page);
  // форма — сверху, список — там, где его оставили (прокручивается корень приложения)
  await o.page.locator('[data-wine-filter="all"]').click(); await sleep(400);
  await o.page.evaluate(() => document.querySelector('[data-wine-erow="w-pin"]').scrollIntoView({ block: "center" })); await sleep(300);
  const rowTop = () => o.page.evaluate(() => Math.round(document.querySelector('[data-wine-erow="w-pin"]').getBoundingClientRect().top));
  const y0 = await rootTop(o.page), r0 = await rowTop();
  await o.page.locator('[data-wine-erow="w-pin"] [role="button"]').click(); await sleep(600);
  const yf = await rootTop(o.page);
  await back(o.page);
  const y1 = await rootTop(o.page), r1 = await rowTop();
  // строка сообщения над списком при открытии формы убирается — список может стать короче на её высоту
  ok("NEXT: форма из низа списка открывается сверху, «назад» — список на том же месте", y0 > 100 && yf === 0 && y1 > 100 && Math.abs(r1 - r0) <= 40, JSON.stringify({ y0, yf, y1, r0, r1 }));
  const [e1, e2] = noErr(o); ok("NEXT: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("PAIR", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toHub(o.page);
  const rows = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-train]")].map((e) => e.getAttribute("data-wine-train")).join(","));
  ok("PAIR: в тренировке — «Вино к блюду», «Опиши за 60 секунд», «Как произносить»", rows === "new,glass,deck,quiz,pair,say60,pron", rows);
  await hubOpen(o.page, "pair");
  const n = dishPairs(T_WINES, MENU).length, qs = [];
  for (let i = 0; i < 6; i++) {
    const st0 = await o.page.evaluate(() => { const e = document.querySelector("[data-wine-pairq]"); return e ? { step: e.getAttribute("data-wine-pairq"), t: e.innerText.replace(/\s+/g, " "), photo: !!document.querySelector("[data-wine-pairq-photo]") } : null; });
    if (!st0 || st0.step === "done") break;
    if (i === 0) await shot(o.page, "pair-q");
    await o.page.locator('[data-wine-popt="0"]').click(); await sleep(250);
    const a = await o.page.evaluate(() => ({ ok: document.querySelectorAll('[data-lens-opt="ok"]').length, first: document.querySelector('[data-wine-popt="0"]').getAttribute("data-lens-opt"), why: (document.querySelector("[data-wine-pwhy]") || {}).textContent || "" }));
    qs.push({ ...st0, ...a });
    await o.page.locator("[data-wine-pairq-next]").click(); await sleep(350);
  }
  const right = qs.filter((q) => q.first === "ok").length;
  const done = await o.page.evaluate(() => (document.querySelector('[data-wine-pairq="done"]') || { getAttribute: () => null }).getAttribute("data-wine-pairq-score"));
  ok("PAIR: по блюду на вопрос (с фото блюда), «Что предложить из вина?», после ответа — верное вино и «К нему в карте…»; итог",
    qs.length === n && qs.every((q) => q.ok === 1 && /Гость заказал «.+»\. Что предложить из вина\?/.test(q.t) && /^К нему в карте: /.test(q.why)) && qs.some((q) => q.photo) && done === right + "/" + n, JSON.stringify({ n, qs: qs.map((q) => [q.photo, q.first, q.why.slice(0, 40)]), done }));
  await shot(o.page, "pair-done");
  const [e1, e2] = noErr(o); ok("PAIR: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SAY60", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toHub(o.page); await hubOpen(o.page, "say60");
  const w0 = await o.page.evaluate(() => document.querySelector("[data-wine-say60]").getAttribute("data-wine-say60-wine"));
  await o.page.locator("[data-wine-say60-go]").click(); await sleep(2300);
  const t = await o.page.evaluate(() => Number((document.querySelector("[data-wine-timer]") || { getAttribute: () => "-1" }).getAttribute("data-wine-timer")));
  ok("SAY60: «Старт» — минута пошла", t >= 55 && t <= 59, String(t));
  await shot(o.page, "say60-speak");
  await o.page.locator("[data-wine-say60-stop]").click(); await sleep(400);
  const W0 = T_WINES.find((w) => w.id === w0), pts = describePoints(W0, MENU);
  const c0 = await o.page.evaluate(() => ({ n: Number(document.querySelector("[data-wine-say60-points]").getAttribute("data-wine-say60-points")), keys: [...document.querySelectorAll("[data-wine-point]")].map((e) => e.getAttribute("data-wine-point")) }));
  ok("SAY60: «Я закончил(а)» — сверка с карточкой: только заполненные пункты", c0.n === pts.length && c0.keys.join() === pts.map((p) => p.key).join(), JSON.stringify({ c0, pts: pts.map((p) => p.key) }));
  await o.page.locator("[data-wine-point]").first().click(); await sleep(200);
  const said = await o.page.evaluate(() => document.querySelector("[data-wine-say60-said]").getAttribute("data-wine-say60-said"));
  ok("SAY60: отметил, что назвал, — «Назвал 1 из N»", said === "1/" + pts.length && /Назвал 1 из \d+\. Чего не хватило, то и запомни\./.test(await txt(o.page.locator("[data-wine-say60-said]"))), said);
  await shot(o.page, "say60-compare");
  await o.page.locator("[data-wine-say60-next]").click(); await sleep(500);
  const w1 = await o.page.evaluate(() => ({ id: document.querySelector("[data-wine-say60]").getAttribute("data-wine-say60-wine"), ph: document.querySelector("[data-wine-say60]").getAttribute("data-wine-say60") }));
  const d5 = await lsGet(o.page, "sa_daily5_Анна_Смирнова");
  ok("SAY60: «Следующее вино» — другое вино, снова «Старт»; сверка — в счёт «пяти в день»", w1.id !== w0 && w1.ph === "ready" && !!d5 && d5.n === 1, JSON.stringify({ w0, w1, d5 }));
  const [e1, e2] = noErr(o); ok("SAY60: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("PRON", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: ANNA, srv, menu: MENU_T });
  await photoRoutes(o.ctx, []);
  await o.page.addInitScript(() => { try { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); } catch (e) {} });
  await hideToasts(o.page);
  await toHub(o.page); await hubOpen(o.page, "deck");
  await o.page.locator('[data-wine-go="1"]').click(); await sleep(900);
  const front = await o.page.locator("[data-wine-deck-card] [data-wine-say]").count();
  await o.page.locator("[data-wine-deck-card]").click(); await sleep(1200);
  const say = await o.page.evaluate(() => { const e = document.querySelector("[data-wine-deck-card] [data-wine-say]"); return e ? { n: +e.getAttribute("data-wine-say"), t: e.innerText.replace(/\s+/g, " ") } : null; });
  ok("PRON: на обороте «Шабли» — «Как произносить»: Шабли и шардоне (сначала из названия), с оригиналом; на лицевой нет", front === 0 && !!say && say.n === 2 && /^Как произносить Шабли\u0301 Chablis ориг\. Шардоне\u0301 Chardonnay ориг\.$/.test(say.t), JSON.stringify({ front, say }));
  await o.page.locator('[data-wine-deck-card] [data-wine-say] [data-say="ru"]').first().click(); await sleep(500);
  const still = await o.page.evaluate(() => document.querySelector("[data-wine-flip]").getAttribute("data-wine-flip"));
  ok("PRON: «послушать» не переворачивает карточку", still === "back", still);
  await shot(o.page, "pron-back");
  await back(o.page); await hubOpen(o.page, "pron");
  const d = await o.page.evaluate(() => ({ cat: [...document.querySelectorAll("[data-pron-cat]")].map((e) => e.textContent + (e.getAttribute("data-lens-btn") === "tab" ? "*" : "")), items: [...document.querySelectorAll("[data-pron-item]")].map((e) => e.innerText.replace(/\s+/g, " ")).slice(0, 4) }));
  ok("PRON: словарь в тренировке — раздел «Наша карта» открыт: слова из своих вин, «в карте: «…»»", d.cat[0] === "Наша карта*" && d.items.length >= 3 && d.items.every((t) => /в карте: «/.test(t)) && d.items.some((t) => /Шабли\u0301/.test(t)), JSON.stringify(d));
  await shot(o.page, "pron-dict");
  const [e1, e2] = noErr(o); ok("PRON: без ошибок", e1, e2);
  await o.ctx.close();
});

// линза и «Для чтения»: сводка и разделы формы — карточки линзы, чипы — стекло; подписи читаются; свет их не съедает
const look124 = async (tag, light) => {
  const P = pal(light);
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T, light });
  await hideToasts(o.page);
  await toEditor(o.page);
  const sc = await st(o.page, "[data-wine-sum-card]"), gp = await st(o.page, '[data-wine-gap="noshort"]');
  ok(`${tag}: сводка — карточка линзы, чипы «Что дописать» — стекло`, !!sc && /radial-gradient/.test(sc.img) && sc.bc === P.EDGE && !!gp && gp.bg === P.GLASS, JSON.stringify([sc, gp]).slice(0, 300));
  const low1 = light ? await pxAll(o.page, ["[data-wine-sum-line]", "[data-wine-checked]", '[data-wine-gap="noshort"]']) : [];
  const la1 = await lightAudit(o.page);
  await shot(o.page, tag.toLowerCase() + "-summary");
  await o.page.locator("[data-wine-new]").click(); await sleep(500);
  const pc = await st(o.page, '[data-wine-part="origin"]'), hn = await st(o.page, '[data-wine-hints="country"] [data-wine-hint]');
  ok(`${tag}: разделы формы — карточки линзы, подсказки — стекло`, !!pc && /radial-gradient/.test(pc.img) && pc.bc === P.EDGE && !!hn && hn.bg === P.GLASS, JSON.stringify([pc, hn]).slice(0, 300));
  const low2 = light ? await pxAll(o.page, ['[data-wine-part="origin"] [data-wine-part-fill]', '[data-wine-hints="country"] [data-wine-hint]']) : [];
  const la2 = await lightAudit(o.page);
  await shot(o.page, tag.toLowerCase() + "-form");
  if (light) ok(`${tag}: подписи сводки и формы читаются (контраст по пикселям)`, !low1.length && !low2.length, JSON.stringify([low1, low2]));
  ok(`${tag}: свет карточек не съедает подписи сводки и разделов`, la1.n > 5 && !la1.out.length && la2.n > 5 && !la2.out.length, JSON.stringify([la1, la2]).slice(0, 400));
  // новые тренировки: «Опиши за 60 секунд» (сверка) и «Вино к блюду» (вопрос и пояснение)
  await back(o.page); await back(o.page); await sleep(500);
  await o.page.locator("[data-wine-train-open]").click(); await sleep(700);
  await hubOpen(o.page, "say60");
  await o.page.locator("[data-wine-say60-go]").click(); await sleep(300); await o.page.locator("[data-wine-say60-stop]").click(); await sleep(400);
  const low3 = light ? await pxAll(o.page, ["[data-wine-say60-said]", "[data-wine-point] span span"]) : [];
  const la3 = await lightAudit(o.page);
  await shot(o.page, tag.toLowerCase() + "-say60");
  await back(o.page); await hubOpen(o.page, "pair");
  await o.page.locator('[data-wine-popt="0"]').click(); await sleep(300);
  const low4 = light ? await pxAll(o.page, ["[data-wine-pwhy]"]) : [];
  await shot(o.page, tag.toLowerCase() + "-pair");
  if (light) ok(`${tag}: «Опиши за 60 секунд» и «Вино к блюду» читаются (контраст по пикселям)`, !low3.length && !low4.length, JSON.stringify([low3, low4]));
  ok(`${tag}: свет карточки сверки не съедает подписи`, la3.n > 3 && !la3.out.length, JSON.stringify(la3).slice(0, 300));
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LENS", () => look124("LENS", false));
await run("PAPER", () => look124("PAPER", true));

await run("NOW", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T, seedExtra: { sa_home_look: "now" } });
  await hideToasts(o.page);
  await toEditor(o.page);
  const sc = await st(o.page, "[data-wine-sum-card]");
  await o.page.locator("[data-wine-new]").click(); await sleep(500);
  const pc = await st(o.page, '[data-wine-part="origin"]');
  ok("NOW: вид «как сейчас» — сводка и разделы формы без света линзы", !!sc && !/radial-gradient/.test(sc.img) && !!pc && !/radial-gradient/.test(pc.img), JSON.stringify([sc && sc.img, pc && pc.img]));
  await shot(o.page, "now-form");
  await o.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf(MENU_T);
  const o = await open({ who: MARIA, srv, menu: MENU_T, w: 320, h: 700 });
  await photoRoutes(o.ctx, []);
  await hideToasts(o.page);
  await toEditor(o.page);
  const f0 = await fits(o.page);
  await shot(o.page, "narrow-summary");
  await o.page.locator('[data-wine-erow="w-chi"] [role="button"]').click(); await sleep(600);
  const f1 = await fits(o.page);
  await shot(o.page, "narrow-form");
  await back(o.page);
  await o.page.locator("[data-wine-new]").click(); await sleep(500);
  const f2 = await fits(o.page);
  await back(o.page); await back(o.page); await sleep(600);
  await o.page.locator("[data-wine-train-open]").click(); await sleep(700);
  await hubOpen(o.page, "pair");
  const f3 = await fits(o.page);
  await back(o.page); await hubOpen(o.page, "say60");
  await o.page.locator("[data-wine-say60-go]").click(); await sleep(400); await o.page.locator("[data-wine-say60-stop]").click(); await sleep(300);
  const f4 = await fits(o.page);
  await shot(o.page, "narrow-say60");
  await back(o.page); await hubOpen(o.page, "pron");
  const f5 = await fits(o.page);
  ok("NARROW: 320 px — сводка, форма (правка и новое), «Вино к блюду», «Опиши за 60 секунд», словарь без сдвига вбок", [f0, f1, f2, f3, f4, f5].every((f) => f.sw <= f.W), JSON.stringify([f0, f1, f2, f3, f4, f5]));
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
