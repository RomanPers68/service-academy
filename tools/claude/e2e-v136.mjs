// e2e v136 (Доп. 449): «Барная карта» ещё удобнее и красивее. Владелец (04.11): «Как думаешь, ещё удобнее и красивее барную
// карту можно сделать?» — на десять предложений «Давай все» (первый, «карта сразу на первом экране», — «пока не будем делать»).
// Разделы: WINES (порядок «Разделы · Цена · А–Я» и «Подробно · Кратко», помнит телефон; «★ Советуем»; точки разделов;
// нарисованные бутылки; «Фильтр»), CARD (сегодня нет — «Предложи вместо», «Похожие в нашей карте», «Как сказать», фото
// крупно), PRIO (руководитель: «☆ Советовать первым» в карточке, та же запись, что у «Сомелье»), COCKTAILS («шейк · купе ·
// Hendrick's» в одну строку, «★ советуем», «Кратко», «Как готовить» свёрнуто), SPIRITS (бутылка по виду, «Кратко» — цена
// порции), PRINT (на листе бутылки: фото или нарисованная; «С бутылками ✓»), EDIT («Править» из карточки не стирает фото),
// NARROW (320 px, светлая тема: всё в ширину, текст читается).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v136.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5330, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v136";
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

// ── v131: «Сомелье» ──
// касание строки «Сомелье» без прокрутки к ней (место списка не меняется)
const toSom = async (page, tab) => { if (!(await openBar(page, tab))) return false; await until(() => page.locator("[data-bar-som-open]").count(), 6000);
  await page.evaluate(() => document.querySelector("[data-bar-som-open]").click()); return until(() => page.locator("[data-som]").count(), 6000); };
const som = (page) => page.evaluate(() => { const r = document.querySelector("[data-som]"); if (!r) return null;
  const t = (sel) => [...r.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, " ").replace(/ /g, " ").trim());
  const at = (sel, a) => (r.querySelector(sel) || { getAttribute: () => null }).getAttribute(a);
  return { what: r.getAttribute("data-som"), whats: at("[data-som-whats]", "data-som-whats"), text: ((r.querySelector("[data-som-text]") || {}).value || "").replace(/ /g, " "),
    chips: [...r.querySelectorAll("[data-som-chip]")].map((e) => e.getAttribute("data-som-chip") + (e.getAttribute("aria-pressed") === "true" ? "+" : "")).join(","),
    sub: at("[data-som-sub]", "data-som-sub"), opts: t("[data-som-opt]"), res: at("[data-som-res]", "data-som-res"), label: t("[data-som-label]")[0] || "",
    picks: [...r.querySelectorAll("[data-som-pick]")].map((e) => e.getAttribute("data-som-pick")), titles: [...r.querySelectorAll("[data-som-pick]")].map((e) => ((e.querySelector("[data-som-open] div div div:nth-child(2)") || {}).textContent || "").trim()),
    why: t("[data-som-why]"), say: t("[data-som-say]"), none: t("[data-som-none]")[0] || "", err: at("[data-som-err]", "data-som-err"), errT: t("[data-som-err]")[0] || "", note: t("[data-som-note]")[0] || "",
    left: at("[data-som-left]", "data-som-left"), foot: t("[data-som-foot]")[0] || "", more: !!r.querySelector("[data-som-more]"), cheaper: !!r.querySelector("[data-som-cheaper]"), msg: t("[data-som-msg]")[0] || "",
    busy: !!r.querySelector("[data-som-busy]"), title: ((((document.querySelector('[data-lens="back"]') || {}).nextElementSibling || {}).lastElementChild) || {}).textContent || "" }; });
// ai-chat — свои ответы: что ушло (calls) и что ответить (answer(b) → тело ответа или "abort")
const aiMock = (ctx, calls, answer, ms = 0) => ctx.route("**/functions/v1/ai-chat", async (route) => {
  let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
  calls.push(b);
  if (ms) await sleep(ms);
  const r = answer(b);
  if (r === "abort") return route.abort();
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) });
});
const msgOf = (b) => String(((b && b.messages) || [])[0] ? b.messages[0].content : "").replace(/ /g, " ");
const listOf = (b) => msgOf(b).split("\n").filter((l) => /^\d+\. /.test(l));
const nameAt = (b, n) => (listOf(b)[n - 1] || "").split(" · ")[1] || "";
const PICK = (ns) => (b) => { const L = listOf(b).length; let use = ns.filter((n) => n <= L); if (!use.length && L) use = [1];
  return { ok: true, remaining: 12, reply: use.map((n) => "[[pick:" + n + "]] Почему: подходит под просьбу, номер " + n + ". Гостю: «Советую " + nameAt(b, n) + "»").join("\n") }; };
// подобрать и дождаться нового ответа (у ответа своя метка времени data-som-at)
const resAt = (page) => page.evaluate(() => (document.querySelector("[data-som-res]") || { getAttribute: () => null }).getAttribute("data-som-at"));
const goSom = async (page, text = null) => { if (text != null) await page.locator("[data-som-text]").fill(text); const old = await resAt(page); await page.locator("[data-som-go]").click();
  return until(async () => { const a = await resAt(page); return a && a !== old && !(await page.locator("[data-som-busy]").count()); }, 9000); };

// ── v136: «Барная карта» ещё удобнее и красивее ──
// запись «советуем первым» (как lib/sommelier.js: SOM_RULES_ID, readSomRules, withSomRules; тот модуль тянет импорты без .js)
const SOM_ID = "__somrules__";
const readSomRules = (shared) => { const r = (shared || []).find((d) => d && d.id === SOM_ID); return { text: r ? String(r.text || "") : "", prio: r && Array.isArray(r.prio) ? r.prio.map(String) : [], by: r ? String(r.by || "") : "", at: r ? Number(r.at) || 0 : 0 }; };
const withSomRules = (shared, r) => [...(shared || []).filter((d) => !(d && d.id === SOM_ID)), { id: SOM_ID, kind: "somrules", text: r.text || "", prio: [...new Set(r.prio || [])], by: r.by || "", at: r.at || Date.now() }];
// руководитель отметил «★ Советуем первым» Пино Нуар, Glenfiddich и Негрони; Кьянти сегодня закончилось
const RULES6 = { text: "", prio: ["wine:w-pin", "spirit:sp-gle", "cocktail:negroni"], by: "Мария Ким", at: PNOW - 2 * DAY };
const MENU6 = withSomRules(MENU_B.map((d) => (d && d.id === "w-chi" ? { ...d, stop: { since: PNOW - 3600e3, by: "Мария Ким" } } : d)), RULES6);
const rows6 = (page) => page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((r) => ({ id: r.getAttribute("data-wine-row"), short: r.hasAttribute("data-wine-short"),
  thumb: (r.querySelector("[data-wine-thumb]") || { getAttribute: () => "" }).getAttribute("data-wine-thumb"), prio: !!r.querySelector("[data-wine-prio]"), h: Math.round(r.getBoundingClientRect().height),
  price: ((r.querySelector("[data-wine-short-price]") || {}).textContent || "").replace(/ /g, " "), glass: !!r.querySelector("[data-wine-short-glass]") })));
const view6 = (page) => page.evaluate(() => ({ view: (document.querySelector("[data-bar-view]") || { getAttribute: () => "" }).getAttribute("data-bar-view"),
  sorts: [...document.querySelectorAll("[data-bar-sort]")].map((e) => e.getAttribute("data-bar-sort") + (e.getAttribute("aria-pressed") === "true" ? "+" : "")).join(","),
  short: (document.querySelector('[data-bar-short][aria-pressed="true"]') || { getAttribute: () => "" }).getAttribute("data-bar-short") }));
// в ширину экрана: как fits, но ряд разделов листается вбок (.sa-hscroll) — его кнопки за краем не считаются
const fits6 = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect();
  return r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !e.closest(".sa-hscroll") && !e.closest("[data-nb-sheet]") && !e.closest("[data-chat]"); })
  .map((e) => (typeof e.className === "string" && e.className ? e.className.slice(0, 40) : e.tagName) + ":" + (e.textContent || "").trim().slice(0, 16)); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
const tapSel = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.click(); return !!e; }, sel);
const somRec = (srv) => readSomRules(srv.S.menu || []);

await run("WINES", async () => {
  const srv = srvOf(MENU6);
  const o = await open({ who: ANNA, srv });
  await hideToasts(o.page);
  ok("WINES: «Барная карта» → «Вина»", await openBar(o.page, "wine"));
  await until(() => o.page.locator("[data-bar-view]").count(), 8000);
  const v0 = await view6(o.page), r0 = await rows6(o.page);
  ok("WINES: над списком «Разделы · Цена · А–Я» и «Подробно · Кратко»; сначала — по разделам, подробно", v0.view === "sec" && v0.sorts === "sec+,price,az" && v0.short === "off", JSON.stringify(v0));
  ok("WINES: у каждой строки бутылка: у Пино Нуар — фото, у остальных — нарисованная", r0.length === 6 && r0.every((r) => r.thumb) && r0.find((r) => r.id === "w-pin").thumb === "photo"
    && r0.filter((r) => r.thumb === "art").length === 5, JSON.stringify(r0.map((r) => r.id + ":" + r.thumb)));
  const art = await o.page.evaluate(() => [...document.querySelectorAll('[data-wine-thumb="art"] img')].map((i) => ({ svg: i.src.startsWith("data:image/svg+xml"), ok: i.complete && i.naturalWidth > 0, h: Math.round(i.getBoundingClientRect().height) })));
  ok("WINES: нарисованные бутылки — картинки SVG, загрузились, по высоте строки миниатюры", art.length === 5 && art.every((a) => a.svg && a.ok && a.h >= 40 && a.h <= 50), JSON.stringify(art));
  const ch = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-only]")].map((b) => b.getAttribute("data-wine-only") + (b.querySelector("[data-bar-dot]") ? "•" : "")).join(","));
  ok("WINES: разделы «Все, ★ Советуем, Бокалом, …» и у цветов вина — точка", /^all,prio,glass,/.test(ch) && /sparkling•/.test(ch) && /red•/.test(ch) && !/all•|prio•|glass•/.test(ch), ch);
  ok("WINES: «★ советуем» — у Пино Нуар", r0.filter((r) => r.prio).map((r) => r.id).join(",") === "w-pin");
  const fb = await txt(o.page.locator("[data-wine-pick-open]"));
  ok("WINES: кнопка «Фильтр» (было «Подобрать», как у «Сомелье»)", fb === "Фильтр", fb);
  await o.page.locator("[data-wine-pick-open]").click(); await sleep(400);
  const fp = await o.page.evaluate(() => (document.body.innerText.match(/Фильтр\s+Бюджет/) || [""])[0].replace(/\s+/g, " "));
  ok("WINES: панель называется «Фильтр»", fp === "Фильтр Бюджет", fp);
  await o.page.locator("[data-wine-pick-open]").click(); await sleep(300);
  await shot(o.page, "wines-top");
  // «Цена»: одним списком, от недорогих; «А–Я» — по названию
  await tapSel(o.page, '[data-bar-sort="price"]'); await sleep(400);
  const rp = (await rows6(o.page)).map((r) => r.id), flat = await o.page.locator('[data-wine-flat="price"]').count(), heads = await o.page.locator("[data-wine-sec-ok], [data-wine-list] [data-bar-dot] + span").count();
  ok("WINES: «Цена» — одним списком от недорогих: Просекко, Гави, Шабли, Розе, Пино Нуар, Кьянти", flat === 1 && rp.join(",") === "w-pro,w-gav,w-cha,w-ros,w-pin,w-chi", rp.join(","));
  await shot(o.page, "wines-price");
  await tapSel(o.page, '[data-bar-sort="az"]'); await sleep(400);
  const ra = (await rows6(o.page)).map((r) => r.id);
  ok("WINES: «А–Я» — по названию", ra.join(",") === "w-gav,w-chi,w-pin,w-pro,w-ros,w-cha", ra.join(","));
  await tapSel(o.page, '[data-bar-sort="sec"]'); await sleep(300);
  // «Кратко»: одна строка — точка, название, «★», значок бокала или «сегодня нет», цена бутылки
  await tapSel(o.page, '[data-bar-short="on"]'); await sleep(400);
  const rs = await rows6(o.page);
  ok("WINES: «Кратко» — строки в одну линию (ниже 52 px), у бокальных — значок бокала, цена бутылки", rs.length === 6 && rs.every((r) => r.short && r.h <= 52)
    && rs.find((r) => r.id === "w-cha").glass && rs.find((r) => r.id === "w-cha").price === "5 200 ₽" && !rs.find((r) => r.id === "w-ros").glass, JSON.stringify(rs.map((r) => r.id + ":" + r.h + ":" + r.price + (r.glass ? ":g" : ""))));
  const st = await o.page.evaluate(() => { const r = document.querySelector('[data-wine-row="w-chi"]'); return r ? r.innerText.replace(/\s+/g, " ") : ""; });
  ok("WINES: «Кратко» — у Кьянти «сегодня нет»", /сегодня нет/.test(st), st);
  await shot(o.page, "wines-short");
  // телефон помнит: другой порядок и вид — после перезагрузки те же; у коктейлей — свои
  await tapSel(o.page, '[data-bar-sort="price"]'); await sleep(300);
  const ls = await o.page.evaluate(() => ({ s: localStorage.getItem("sa_bar_sort_wine"), k: localStorage.getItem("sa_bar_short_wine") }));
  await o.page.reload({ waitUntil: "load" }); await o.page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => {});
  await hideToasts(o.page);
  await openBar(o.page, "wine"); await until(() => o.page.locator("[data-bar-view]").count(), 8000);
  const v1 = await view6(o.page);
  ok("WINES: порядок и вид помнит телефон (после перезагрузки — «Цена», «Кратко»)", ls.s === "price" && ls.k === "1" && v1.view === "price,short", JSON.stringify({ ls, v1 }));
  await tapSel(o.page, '[data-bar-tab="cocktail"]'); await sleep(700);
  const vc = await view6(o.page);
  ok("WINES: у коктейлей свой вид — «Разделы», «Подробно»", vc.view === "sec", JSON.stringify(vc));
  await tapSel(o.page, '[data-bar-tab="wine"]'); await sleep(600);
  await tapSel(o.page, '[data-bar-sort="sec"]'); await tapSel(o.page, '[data-bar-short="off"]'); await sleep(300);
  // раздел «★ Советуем»
  await tapSel(o.page, '[data-wine-only="prio"]'); await sleep(400);
  const rr = (await rows6(o.page)).map((r) => r.id).join(",");
  const note = await listFilter(o.page);
  ok("WINES: раздел «★ Советуем» — только Пино Нуар, «Показаны: советуем, 1 из 6»", rr === "w-pin" && /^Показаны: советуем, 1 из 6/.test(note), rr + " · " + note);
  const fits0 = await fits6(o.page);
  ok("WINES: ничего не выходит за ширину экрана (ряд разделов листается)", fits0.over.length === 0 && fits0.sw === fits0.W, JSON.stringify(fits0));
  const [e1, e2] = noErr(o); ok("WINES: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("CARD", async () => {
  const srv = srvOf(MENU6);
  const o = await open({ who: ANNA, srv });
  await hideToasts(o.page);
  await photoCors(o.ctx);
  await openBar(o.page, "wine"); await until(() => o.page.locator('[data-wine-row="w-chi"]').count(), 8000);
  await o.page.locator('[data-wine-row="w-chi"]').click(); await sleep(900);
  const c0 = await o.page.evaluate(() => { const b = document.querySelector("[data-wine-instead]"); return { t: b ? b.innerText.replace(/\s+/g, " ").slice(0, 32) : "",
    go: [...document.querySelectorAll("[data-wine-instead] [data-wine-similar-go]")].map((e) => e.getAttribute("data-wine-similar-go")).join(","), art: !!document.querySelector("[data-wine-hero] [data-wine-art] img"),
    sim: !!document.querySelector("[data-wine-similar]"), heroTop: Math.round((document.querySelector("[data-wine-hero]") || { getBoundingClientRect: () => ({ top: -1 }) }).getBoundingClientRect().top),
    short: Math.round(([...document.querySelectorAll("[data-wine-card] div")].find((d) => d.textContent.startsWith("«") && d.textContent.length > 10) || { getBoundingClientRect: () => ({ top: 9999 }) }).getBoundingClientRect().top) }; });
  ok("CARD: Кьянти сегодня нет — сразу «Предложи вместо» Пино Нуар (красное, цена рядом); «Похожих» ниже нет", /^Сегодня нет\. Предложи вместо:/.test(c0.t) && c0.go === "w-pin" && !c0.sim, JSON.stringify(c0));
  ok("CARD: шапка карточки — нарисованная бутылка слева", c0.art);
  await shot(o.page, "card-stop");
  await o.page.locator('[data-wine-instead] [data-wine-similar-go="w-pin"]').click(); await sleep(900);
  const c1 = await o.page.evaluate(() => ({ id: (document.querySelector("[data-wine-card]") || { getAttribute: () => "" }).getAttribute("data-wine-card"), photo: !!document.querySelector("[data-wine-hero] [data-wine-photo-big] img"),
    say: (document.querySelector("[data-bar-say]") || { getAttribute: () => "" }).getAttribute("data-bar-say"), prio: ((document.querySelector("[data-wine-hero]") || {}).innerText || "").includes("★ советуем"),
    shortTop: Math.round(([...document.querySelectorAll("[data-wine-card] div")].find((d) => /^«Лёгкое/.test(d.textContent)) || { getBoundingClientRect: () => ({ top: 9999 }) }).getBoundingClientRect().top) }));
  ok("CARD: касание — карточка Пино Нуар: фото в шапке, «★ советуем», «Как сказать: Пино́ нуа́р»", c1.id === "w-pin" && c1.photo && c1.prio && /^Пино нуар/.test(c1.say), JSON.stringify(c1));
  await o.page.locator("[data-wine-photo-big]").click(); await sleep(400);
  const big = await o.page.evaluate(() => { const i = document.querySelector("[data-wine-photo-full] img"); if (!i) return null; const r = i.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), alt: i.alt }; });
  ok("CARD: касание фото — крупно на весь экран («Бутылка: Пино Нуар 2020»)", !!big && big.h > 300 && /^Бутылка: Пино Нуар/.test(big.alt), JSON.stringify(big));
  await shot(o.page, "card-photo-full");
  await o.page.locator("[data-wine-photo-full]").click(); await sleep(300);
  ok("CARD: второе касание закрывает", !(await o.page.locator("[data-wine-photo-full]").count()));
  await back(o.page); await sleep(400);
  await o.page.locator('[data-wine-row="w-cha"]').click(); await sleep(900);
  const c2 = await o.page.evaluate(() => ({ say: (document.querySelector("[data-bar-say]") || { getAttribute: () => "" }).getAttribute("data-bar-say"), sayT: ((document.querySelector("[data-bar-say]") || {}).textContent || ""),
    sim: [...document.querySelectorAll("[data-wine-similar] [data-wine-similar-go]")].map((e) => e.getAttribute("data-wine-similar-go")).join(","), prioBtn: !!document.querySelector("[data-bar-prio]") }));
  ok("CARD: Шабли — «Как сказать: Шабли́ · Шардоне́», «Похожие в нашей карте» — белые рядом по цене", /^Шабли,Шардоне/.test(c2.say) && /Как сказать: Шабли́ · Шардоне́/.test(c2.sayT) && /^w-gav/.test(c2.sim) && !c2.sim.includes("w-chi"), JSON.stringify(c2));
  ok("CARD: официанту — без «Советовать первым»", !c2.prioBtn);
  await o.page.locator("[data-wine-similar] [data-wine-similar-go]").first().click(); await sleep(900);
  const c3 = await o.page.evaluate(() => (document.querySelector("[data-wine-card]") || { getAttribute: () => "" }).getAttribute("data-wine-card"));
  ok("CARD: касание похожего — его карточка", c3 === "w-gav", c3);
  await shot(o.page, "card-similar");
  const [e1, e2] = noErr(o); ok("CARD: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("PRIO", async () => {
  const srv = srvOf(MENU6);
  const o = await open({ who: MARIA, srv });
  await hideToasts(o.page);
  await openBar(o.page, "wine"); await until(() => o.page.locator('[data-wine-row="w-cha"]').count(), 8000);
  await o.page.locator('[data-wine-row="w-cha"]').click(); await sleep(900);
  const p0 = await o.page.evaluate(() => { const b = document.querySelector("[data-bar-prio]"); return b ? { on: b.getAttribute("data-bar-prio"), t: b.textContent.trim(), dis: b.disabled } : null; });
  ok("PRIO: руководителю в карточке — «☆ Советовать первым»", !!p0 && p0.on === "off" && p0.t === "☆ Советовать первым" && !p0.dis, JSON.stringify(p0));
  const n0 = srv.calls.filter((c) => c.fn === "menu_set").length;
  await o.page.locator("[data-bar-prio]").click();
  await until(async () => (await o.page.locator('[data-bar-prio="on"]').count()) > 0, 6000);
  const r1 = somRec(srv), n1 = srv.calls.filter((c) => c.fn === "menu_set").length;
  ok("PRIO: касание — «★ Советуем первым»; в меню команды та же запись, что у «Сомелье» (кто и когда)", n1 === n0 + 1 && r1.prio.join(",") === "wine:w-pin,spirit:sp-gle,cocktail:negroni,wine:w-cha" && r1.by === "Мария Ким" && r1.at > RULES6.at,
    JSON.stringify({ n0, n1, r1 }));
  const ws = wines(srv).find((w) => w.id === "w-pin");
  ok("PRIO: остальное меню на месте (фото Пино Нуар и стоп Кьянти)", !!ws && /^https:\/\/photos\.e2e\//.test(ws.img) && !!(wines(srv).find((w) => w.id === "w-chi") || {}).stop, JSON.stringify({ img: ws && ws.img }));
  await shot(o.page, "prio-on");
  await back(o.page); await sleep(500);
  const pr0 = (await rows6(o.page)).filter((r) => r.prio).map((r) => r.id).sort().join(",");
  ok("PRIO: в списке «★ советуем» — у Шабли и Пино Нуар", pr0 === "w-cha,w-pin", pr0);
  await o.page.locator('[data-wine-row="w-pin"]').click(); await sleep(900);
  const hero = await o.page.evaluate(() => ((document.querySelector("[data-wine-hero]") || {}).innerText || "").replace(/\s+/g, " "));
  ok("PRIO: руководителю в шапке без значка «★ советуем» (состояние — на переключателе)", !/★ советуем(?! первым)/.test(hero.replace("★ Советуем первым", "")) && /★ Советуем первым/.test(hero), hero);
  await o.page.locator("[data-bar-prio]").click();
  await until(async () => (await o.page.locator('[data-bar-prio="off"]').count()) > 0, 6000);
  ok("PRIO: снять — «☆ Советовать первым», из записи ушло", somRec(srv).prio.join(",") === "spirit:sp-gle,cocktail:negroni,wine:w-cha", somRec(srv).prio.join(","));
  // коктейль — то же в карточке коктейля
  await openBar(o.page, "cocktail"); await until(() => o.page.locator('[data-bar-ck="negroni"]').count(), 8000);
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(800);
  await o.page.locator("[data-bar-prio]").click();
  await until(async () => (await o.page.locator('[data-bar-prio="off"]').count()) > 0, 6000);
  ok("PRIO: у коктейля — так же («Негрони» снят)", !somRec(srv).prio.includes("cocktail:negroni"), somRec(srv).prio.join(","));
  // ошибка сохранения — словами
  const o2 = await open({ who: MARIA, srv, rpcs: (fn) => (fn === "menu_set" ? { ok: false, error: "forbidden" } : undefined) });
  await hideToasts(o2.page);
  await openBar(o2.page, "wine"); await until(() => o2.page.locator('[data-wine-row="w-ros"]').count(), 8000);
  await o2.page.locator('[data-wine-row="w-ros"]').click(); await sleep(900);
  await o2.page.locator("[data-bar-prio]").click(); await sleep(900);
  const em = await txt(o2.page.locator("[data-wine-check-msg]"));
  ok("PRIO: не сохранилось — «Не сохранилось. Проверь связь и права», отметка не встала", em === "Не сохранилось. Проверь связь и права" && (await o2.page.locator('[data-bar-prio="off"]').count()) === 1, em);
  const [e1, e2] = noErr(o, o2); ok("PRIO: без ошибок", e1, e2);
  await o.ctx.close(); await o2.ctx.close();
});

await run("COCKTAILS", async () => {
  const srv = srvOf(MENU6);
  const o = await open({ who: ANNA, srv });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail"); await until(() => o.page.locator('[data-bar-ck="negroni"]').count(), 8000);
  const neg = await o.page.evaluate(() => { const r = document.querySelector('[data-bar-ck="negroni"]'); const s = r && r.querySelector("[data-bar-ck-spirits]");
    return r ? { t: r.innerText.replace(/\s+/g, " "), line: s ? s.parentElement.textContent.replace(/\s+/g, " ") : "", lines: s ? Math.round(s.parentElement.getBoundingClientRect().height) : 0, h: Math.round(r.getBoundingClientRect().height) } : null; });
  ok("COCKTAILS: у «Негрони» в одной строке «стир · рокс · Beefeater, Campari» и «★ советуем»", !!neg && neg.line === "стир · рокс · Beefeater, Campari" && /★ советуем/.test(neg.t) && neg.lines <= 20, JSON.stringify(neg));
  ok("COCKTAILS: строка коктейля — не выше 76 px (была в три строки)", !!neg && neg.h <= 76, JSON.stringify(neg && neg.h));
  const v = await view6(o.page);
  ok("COCKTAILS: «Разделы · А–Я» (цен у коктейлей нет — без «Цены») и «Подробно · Кратко»", v.sorts === "sec+,az" && v.short === "off", JSON.stringify(v));
  const ch = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-ck-only]")].map((b) => b.getAttribute("data-bar-ck-only") + (b.querySelector("[data-bar-dot]") ? "•" : "")).join(","));
  ok("COCKTAILS: разделы «Все, ★ Советуем, Джин•, Водка•…» — у основ точка", /^all,prio,Джин•,Водка•/.test(ch), ch);
  await shot(o.page, "cocktails");
  await tapSel(o.page, '[data-bar-ck-only="prio"]'); await sleep(400);
  ok("COCKTAILS: «★ Советуем» — только «Негрони»", (await ckIds(o.page)).join(",") === "negroni");
  await tapSel(o.page, '[data-bar-ck-only="all"]'); await sleep(300);
  await tapSel(o.page, '[data-bar-short="on"]'); await sleep(400);
  const sh = await o.page.evaluate(() => { const r = [...document.querySelectorAll("[data-bar-ck]")]; return { n: r.length, short: r.filter((x) => x.hasAttribute("data-bar-ck-short")).length,
    hMax: Math.max(...r.map((x) => Math.round(x.getBoundingClientRect().height))), art: document.querySelectorAll("[data-bar-ck] [data-bar-ck-art]").length, house: ((document.querySelector('[data-bar-ck="ck-sea"]') || {}).textContent || "") }; });
  ok("COCKTAILS: «Кратко» — все строки в одну линию, без бокалов; у своего — «свой»", sh.n > 50 && sh.short === sh.n && sh.hMax <= 52 && sh.art === 0 && /свой/.test(sh.house), JSON.stringify(sh));
  await shot(o.page, "cocktails-short");
  await tapSel(o.page, '[data-bar-sort="az"]'); await sleep(400);
  const az = await ckIds(o.page), flat = await o.page.locator('[data-bar-ck-flat="az"]').count();
  ok("COCKTAILS: «А–Я» — одним списком по названию", flat === 1 && az.length > 50, String(az.length));
  await tapSel(o.page, '[data-bar-sort="sec"]'); await tapSel(o.page, '[data-bar-short="off"]'); await sleep(300);
  // карточка: «Как готовить» свёрнуто
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(800);
  const k0 = await ckCard(o.page), tg = await txt(o.page.locator("[data-bar-ck-how-toggle]"));
  ok("CARD-CK: «Как готовить · 7 шагов, как в лаборатории ›» свёрнуто, состав сверху", !!k0 && k0.how.length === 0 && k0.ing.length === 3 && tg === "Как готовить · 7 шагов, как в лаборатории ›", JSON.stringify({ tg, ing: k0 && k0.ing }));
  await o.page.locator("[data-bar-ck-how-toggle]").click(); await sleep(300);
  const k1 = await ckCard(o.page);
  ok("CARD-CK: касание — шаги («Стир 20 секунд»)", !!k1 && k1.how.length === 7 && k1.how.some((s) => /Стир 20 секунд/.test(s)) && (await o.page.locator('[data-bar-ck-how-toggle="open"]').count()) === 1, JSON.stringify(k1 && k1.how));
  await shot(o.page, "cocktail-card-how");
  await stepGo(o.page, "next");
  const k2 = await ckCard(o.page);
  ok("CARD-CK: следующий коктейль — снова свёрнуто", !!k2 && k2.id !== "negroni" && k2.how.length === 0 && (await o.page.locator('[data-bar-ck-how-toggle="closed"]').count()) === 1, JSON.stringify(k2 && k2.id));
  await back(o.page);
  await o.page.evaluate(() => { const r = document.querySelector('[data-bar-ck="ck-sea"]'); if (r) r.click(); }); await sleep(800);
  const hs = await txt(o.page.locator("[data-bar-ck-how-toggle]"));
  ok("CARD-CK: у своего коктейля — «Как готовить · 2 шага ›»", hs === "Как готовить · 2 шага ›", hs);
  const [e1, e2] = noErr(o); ok("COCKTAILS: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SPIRITS", async () => {
  const srv = srvOf(MENU6);
  const o = await open({ who: ANNA, srv });
  await hideToasts(o.page);
  await openBar(o.page, "spirit"); await until(() => o.page.locator('[data-wine-row="sp-gle"]').count(), 8000);
  const r0 = await rows6(o.page);
  const looks = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((r) => { const i = r.querySelector('[data-wine-thumb="art"] img'); return i ? r.getAttribute("data-wine-row") + ":" + decodeURIComponent(i.src).length : ""; }).filter(Boolean));
  const kinds = new Set(looks.map((x) => x.split(":")[1]));
  ok("SPIRITS: у каждой позиции бутылка по виду (виски, коньяк, ром, джин, биттер, текила — разные)", r0.length === 7 && r0.every((r) => r.thumb === "art") && kinds.size >= 5, JSON.stringify(looks));
  ok("SPIRITS: «★ советуем» — у Glenfiddich", r0.filter((r) => r.prio).map((r) => r.id).join(",") === "sp-gle");
  const ch = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-only]")].map((b) => b.getAttribute("data-wine-only") + (b.querySelector("[data-bar-dot]") ? "•" : "")).join(","));
  ok("SPIRITS: разделы «Все, ★ Советуем, Ходовое, Виски•…»", /^all,prio,glass,whisky•/.test(ch), ch);
  await shot(o.page, "spirits");
  await tapSel(o.page, '[data-bar-short="on"]'); await sleep(400);
  const rs = await rows6(o.page);
  ok("SPIRITS: «Кратко» — цена порции «40 мл 650 ₽», без «ходовое»", rs.find((r) => r.id === "sp-gle").price === "40 мл 650 ₽" && !(await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-short]")].some((r) => /ходовое/.test(r.textContent)))),
    JSON.stringify(rs.map((r) => r.id + ":" + r.price)));
  await shot(o.page, "spirits-short");
  await tapSel(o.page, '[data-bar-short="off"]'); await sleep(300);
  await o.page.locator('[data-wine-row="sp-gle"]').click(); await sleep(900);
  const c = await o.page.evaluate(() => ({ art: !!document.querySelector("[data-wine-hero] [data-wine-art] img"), say: (document.querySelector("[data-bar-say]") || { getAttribute: () => "" }).getAttribute("data-bar-say"),
    sim: [...document.querySelectorAll("[data-wine-similar] [data-wine-similar-go]")].map((e) => e.getAttribute("data-wine-similar-go")).join(",") }));
  ok("SPIRITS: карточка Glenfiddich — бутылка, «Как сказать: Гленфи́ддик», похожие — виски", c.art && /^Гленфиддик/.test(c.say) && /^sp-mak/.test(c.sim), JSON.stringify(c));
  const [e1, e2] = noErr(o); ok("SPIRITS: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("PRINT", async () => {
  // без фото в карте — «С бутылками ✓», на листе нарисованные бутылки (Path2D, холст не «пачкается»)
  const SPY2 = () => { window.__fill = 0; const P = CanvasRenderingContext2D.prototype, f = P.fill; P.fill = function (a) { if (a instanceof Path2D) window.__fill++; return f.apply(this, arguments); }; };
  const srv = srvOf(withSomRules(MENU_W, RULES6));
  const o = await open({ who: MARIA, srv, init: SPY2 });
  await hideToasts(o.page);
  await openBar(o.page, "wine"); await until(() => o.page.locator("[data-bar-print-open]").count(), 8000);
  await toPrint(o.page);
  const p0 = await pr(o.page), lbl = await txt(o.page.locator("[data-bar-print-photo]"));
  ok("PRINT: в карте нет фото — переключатель «С бутылками ✓»", p0 && p0.photo === "on" && lbl === "С бутылками ✓", JSON.stringify({ photo: p0 && p0.photo, lbl }));
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page);
  const f1 = await o.page.evaluate(() => window.__fill);
  ok("PRINT: страницы собраны, бутылки нарисованы (контуры на холсте)", (await pr(o.page)).pages >= 1 && f1 >= 5 * 4, String(f1));
  await savePage(o.page, "print-bottles");
  await o.page.locator("[data-bar-print-photo]").click(); await sleep(300);
  const lbl2 = await txt(o.page.locator("[data-bar-print-photo]"));
  await o.page.evaluate(() => { window.__fill = 0; });
  await o.page.locator("[data-bar-print-go]").click(); await pagesReady(o.page);
  const f2 = await o.page.evaluate(() => window.__fill);
  ok("PRINT: «Без бутылок» — лист без колонки бутылок", lbl2 === "Без бутылок" && f2 < f1 / 4, JSON.stringify({ lbl2, f1, f2 }));
  // с фото у Пино Нуар — «С фото бутылок ✓»: фото и нарисованные рядом
  const srv2 = srvOf(withSomRules(MENU_P, RULES6));
  const o2 = await open({ who: MARIA, srv: srv2, init: SPY });
  await hideToasts(o2.page); await photoCors(o2.ctx);
  await openBar(o2.page, "wine"); await until(() => o2.page.locator("[data-bar-print-open]").count(), 8000);
  await toPrint(o2.page);
  const l3 = await txt(o2.page.locator("[data-bar-print-photo]"));
  await o2.page.locator("[data-bar-print-go]").click(); await pagesReady(o2.page);
  const di = await o2.page.evaluate(() => window.__di);
  ok("PRINT: есть фото — «С фото бутылок ✓», фото Пино Нуар на листе (drawImage), у остальных — нарисованные", l3 === "С фото бутылок ✓" && di === 1, JSON.stringify({ l3, di }));
  await savePage(o2.page, "print-photo-and-bottles");
  const [e1, e2] = noErr(o, o2); ok("PRINT: без ошибок", e1, e2);
  await o.ctx.close(); await o2.ctx.close();
});

await run("EDIT", async () => {
  // фото, снятое без хранилища (data:), в копии меню телефона не хранится: форма из карточки открывалась без него, «Сохранить» стирало
  const DATA = "data:image/jpeg;base64," + BOTTLE.toString("base64");
  const M = MENU_W.map((d) => (d && d.id === "w-pin" ? { ...d, img: DATA } : d));
  const srv = srvOf(M);
  // в телефоне — копия меню, как её хранит приложение (lib/reference-context.js: фото data: не кладём)
  const o = await open({ who: MARIA, srv, menu: M.map((d) => (d && typeof d.img === "string" && d.img.startsWith("data:") ? { ...d, img: "" } : d)) });
  await hideToasts(o.page);
  const cached = await o.page.evaluate(() => { try { const a = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); const r = Object.values(a)[0] || []; const w = r.find((d) => d && d.id === "w-pin"); return w ? w.img : null; } catch (e) { return "?"; } });
  await openBar(o.page, "wine"); await until(() => o.page.locator('[data-wine-row="w-pin"]').count(), 8000);
  await o.page.locator('[data-wine-row="w-pin"]').click(); await sleep(900);
  await o.page.locator("[data-wine-edit]").click(); await sleep(1500);
  const f = await o.page.evaluate(() => (document.querySelector("[data-wine-photo]") || { getAttribute: () => "" }).getAttribute("data-wine-photo"));
  ok("EDIT: «Править» из карточки — в форме фото бутылки («Фото в карте»), хотя в копии меню телефона его нет", f === "on" && cached === "", JSON.stringify({ f, cached: cached === "" ? "" : String(cached).slice(0, 20) }));
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  const w1 = wines(srv).find((w) => w.id === "w-pin");
  ok("EDIT: «Сохранить» — фото в карте осталось", !!w1 && w1.img === DATA, String(w1 && w1.img).slice(0, 30));
  // «Убрать» — фото уходит, как и раньше
  await o.page.locator("[data-wine-edit]").click(); await sleep(1500);
  await o.page.locator("[data-wine-pic-del]").click(); await sleep(200);
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  const w2 = wines(srv).find((w) => w.id === "w-pin");
  ok("EDIT: «Убрать» и «Сохранить» — фото убрано", !!w2 && !w2.img, String(w2 && w2.img).slice(0, 30));
  const [e1, e2] = noErr(o); ok("EDIT: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf(MENU6);
  for (const light of [false, true]) {
    const tag = light ? "light" : "dark";
    const o = await open({ who: MARIA, srv, w: 320, h: 700, light });
    await hideToasts(o.page);
    await openBar(o.page, "wine"); await until(() => o.page.locator("[data-bar-view]").count(), 8000);
    await o.page.evaluate(() => document.querySelector("[data-bar-view]").scrollIntoView({ block: "center" })); await sleep(300);
    const f0 = await fits6(o.page);
    ok(`NARROW ${tag}: 320 px — вид списка и строки в ширину экрана`, f0.over.length === 0, JSON.stringify(f0));
    await shot(o.page, "narrow-" + tag);
    const low = await pxAll(o.page, ['[data-bar-sort][aria-pressed="true"]', '[data-bar-sort][aria-pressed="false"]', '[data-bar-short][aria-pressed="false"]']);
    ok(`NARROW ${tag}: «Разделы · Цена · А–Я» и «Подробно · Кратко» читаются (контраст по пикселям)`, low.length === 0, low.join(" | "));
    await tapSel(o.page, '[data-bar-short="on"]'); await sleep(400);
    const f1 = await fits6(o.page), rs = await rows6(o.page);
    ok(`NARROW ${tag}: «Кратко» — в одну линию и в ширину (название с многоточием)`, f1.over.length === 0 && rs.every((r) => r.h <= 52), JSON.stringify({ over: f1.over, h: rs.map((r) => r.h) }));
    await shot(o.page, "narrow-short-" + tag);
    await tapSel(o.page, '[data-bar-short="off"]'); await sleep(300);
    await o.page.locator('[data-wine-row="w-chi"]').click(); await sleep(900);
    const f2 = await fits6(o.page);
    ok(`NARROW ${tag}: карточка «сегодня нет» с «Предложи вместо» — в ширину`, f2.over.length === 0, JSON.stringify(f2));
    const lowC = await pxAll(o.page, ["[data-wine-instead] > div", "[data-bar-prio]"]);
    ok(`NARROW ${tag}: «Сегодня нет. Предложи вместо:» и «Советовать первым» читаются`, lowC.length === 0, lowC.join(" | "));
    await shot(o.page, "narrow-card-" + tag);
    const [e1, e2] = noErr(o); ok(`NARROW ${tag}: без ошибок`, e1, e2);
    await o.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
