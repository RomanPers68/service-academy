// e2e v122 (Доп. 435): фото бутылок в «Редакторе вин». Владелец (31.10): «И как думаешь, может в редактор добавим
// возможность загрузки фото бутылок?». Сервер — tools/claude/demo-app/fake-server.js, как e2e-v120; хранилище фото
// (photo-upload) и AI (/api/wine-import, mode label) — своими ответами. Разделы:
//   FORM    — новое вино: снимок → «Загружаю фото…» (Сохранить ждёт), AI сразу читает этикетку, фото уходит в photo-upload
//             под id вина; сохранено со ссылкой; миниатюры в редакторе и в карте; фото в карточке вина;
//   FAIL    — функция не развёрнута: понятная причина, вино без фото (base64 в меню нет); этикетку не прочитать;
//   EXIST   — вино с названием: AI сам не запускается, «Заполнить по этикетке» — только пустые поля; «Убрать»;
//   BOTTLES — «Импорт» → «Фото бутылок»: «Читаю этикетку: 2 из 4», обзор (новое, фото к вину без фото, заменить),
//             сохранение: фото по одному, потом меню;
//   PDF     — длинная карта (владелец: «У меня редактор pdf-ку не принял»): ответ оборвался — ещё заход с after, повтор
//             мимо, «Дополнить ноты и подачу через AI»; продолжение не удалось — прочитанное в обзоре и почему;
//   BULK    — «Верно для всех в списке» (владелец: «Да, давай добавим»): только в «Не проверено», переспрос, с поиском —
//             найденное, кто проверил;
//   CROSS   — «закрыть» в линзе (владелец: «крестик не оцентрован»): крест маской по центру кружка, буквы нет, кольцо
//             вокруг того же центра (по пикселям);
//   LENS, PAPER — блок фото в линзе, контраст; NOW — вид «как сейчас»; NARROW — 320 px.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] [E2E_LOOK=now] node e2e-v122.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v122";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v122";
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

await run("FORM", async () => {
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P });
  const ai = [], up = [];
  await aiRoute(o.ctx, ai, labelAi([LABEL.gavi]));
  await photoRoutes(o.ctx, up, { delay: 500 });
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator("[data-wine-new]").click(); await sleep(400);
  const empty = await txt(o.page.locator("[data-wine-pic-note]"));
  ok("FORM: в новой форме — «Фото бутылки» с подсказкой и «Сфотографировать»", /Сними бутылку этикеткой к камере/.test(empty) && (await o.page.locator("[data-wine-pic-take]").innerText()) === "Сфотографировать", empty);
  await o.page.setInputFiles("[data-wine-pic-input]", shotFile());
  await sleep(250);
  const mid = { note: await txt(o.page.locator("[data-wine-pic-note]")), save: await txt(o.page.locator("[data-wine-save]")), dis: await o.page.locator("[data-wine-save]").isDisabled() };
  ok("FORM: снимок выбран — «Загружаю фото…», «Сохранить» ждёт загрузки", /Загружаю фото/.test(mid.note) && mid.dis && /Загружаю фото/.test(mid.save), JSON.stringify(mid));
  await until(async () => /Фото загружено/.test(await txt(o.page.locator("[data-wine-pic-note]"))), 6000);
  await until(async () => (await o.page.locator('[data-wine-field="name"]').inputValue()) !== "", 6000);
  const f = await o.page.evaluate(() => ({ name: document.querySelector('[data-wine-field="name"]').value, producer: document.querySelector('[data-wine-field="producer"]').value,
    tags: document.querySelectorAll("[data-wine-ai]").length, pic: !!document.querySelector("[data-wine-pic]"), label: !!document.querySelector("[data-wine-label]") }));
  const sent = ai.find((b) => b.mode === "label");
  ok("FORM: новое вино без названия — AI сразу читает этикетку (снимок до 1800 px): название и поля с этикетки, пометки «AI»",
    !!sent && /^\/9j\//.test(sent.imageBase64 || "") && sent.mime === "image/jpeg" && f.name === "Гави ди Гави" && f.producer === "La Scolca" && f.tags >= 3 && f.pic && f.label, JSON.stringify({ f, mode: sent && sent.mode }));
  ok("FORM: фото ушло в photo-upload: снимок JPEG до 700 px (меньше 270 КБ), под id нового вина, с сессией и заведением",
    up.length === 1 && up[0].head === "data:image/jpeg;base64," && up[0].len < 270000 && /^wn-\d+-/.test(up[0].id) && up[0].token && up[0].restaurant === R0, JSON.stringify(up));
  await shot(o.page, "form-photo");
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  const w = wines(srv).find((x) => x.name === "Гави ди Гави");
  ok("FORM: «Сохранить» — вино в меню команды с ссылкой на фото; id вина — тот, под которым лежит фото", !!w && w.img === PHOTO_HOST + "/dva-morya/" + up[0].id + "-1.jpg" && w.id === up[0].id && (w.ai || []).includes("producer"),
    JSON.stringify(w && { id: w.id, img: w.img, ai: w.ai }));
  // строка в редакторе и в карте: миниатюры
  const ed = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-erow] [data-wine-thumb]")].map((t) => t.getAttribute("data-wine-thumb")));
  ok("FORM: в списке редактора у каждой строки миниатюра: у Гави и Пино Нуар — фото, у остальных — силуэт", ed.length === 6 && ed.filter((x) => x === "photo").length === 2, JSON.stringify(ed));
  await o.page.locator("[data-lens=\"back\"]").first().click(); await sleep(1200);
  await toList(o.page); await sleep(1300);
  const rows = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((r) => ({ id: r.getAttribute("data-wine-row"), t: (r.querySelector("[data-wine-thumb]") || { getAttribute: () => "" }).getAttribute("data-wine-thumb") })));
  const loaded = await imgOk(o.page, "[data-wine-row] img");
  ok("FORM: «Винная карта» — миниатюры у всех строк, фото загрузились", rows.length === 6 && rows.every((r) => r.t) && loaded.length === 2 && loaded.every((x) => x.ok), JSON.stringify({ rows, loaded }));
  await shot(o.page, "list-thumbs");
  await o.page.locator(`[data-wine-row="${w.id}"]`).click(); await sleep(900);
  const big = await imgOk(o.page, "[data-wine-photo-big] img");
  const alt = await o.page.locator("[data-wine-photo-big] img").getAttribute("alt").catch(() => "");
  ok("FORM: карточка вина — фото сверху целиком", big.length === 1 && big[0].ok && alt === "Бутылка: Гави ди Гави 2022", JSON.stringify({ big, alt }));
  await shot(o.page, "card-photo");
  const [e1, e2] = noErr(o); ok("FORM: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("FAIL", async () => {
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P });
  const ai = [], up = [];
  await aiRoute(o.ctx, ai, labelAi([]));
  await photoRoutes(o.ctx, up, { fail: true });
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator("[data-wine-new]").click(); await sleep(400);
  await o.page.locator('[data-wine-field="name"]').fill("Бароло"); await sleep(150);
  await o.page.setInputFiles("[data-wine-pic-input]", shotFile());
  await until(async () => /не загрузилось/.test(await txt(o.page.locator("[data-wine-pic-note]"))), 6000);
  const note = await txt(o.page.locator("[data-wine-pic-note]"));
  ok("FAIL: функция не развёрнута — понятная причина, «вино сохранится без него»; с названием AI сам не запускается",
    /Фото не загрузилось: функция photo-upload не развёрнута в Supabase\. Вино сохранится без него\./.test(note) && !ai.some((b) => b.mode === "label"), note);
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  const w = wines(srv).find((x) => x.name === "Бароло");
  ok("FAIL: вино сохранилось без фото (снимка base64 в меню нет)", !!w && w.img === "" && !JSON.stringify(srv.S.menu).includes("data:image"), JSON.stringify(w && { img: w.img }));
  // этикетку не прочитать — причина в форме
  await o.page.locator("[data-wine-new]").click(); await sleep(400);
  await o.page.setInputFiles("[data-wine-pic-input]", shotFile());
  await until(async () => (await o.page.locator('[role="alert"]').count()) > 0, 6000);
  const err = await txt(o.page.locator('[role="alert"]'));
  ok("FAIL: этикетку не прочитать — «сними бутылку ближе, при свете…»", /Этикетку не прочитать: сними бутылку ближе/.test(err), err);
  const [e1, e2] = noErr(o); ok("FAIL: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("EXIST", async () => {
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P });
  const ai = [], up = [];
  await aiRoute(o.ctx, ai, labelAi([LABEL.chablis]));
  await photoRoutes(o.ctx, up);
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator('[data-wine-erow="w-cha"] [role="button"]').click(); await sleep(500);
  await o.page.setInputFiles("[data-wine-pic-input]", shotFile());
  await until(async () => /Фото загружено/.test(await txt(o.page.locator("[data-wine-pic-note]"))), 6000);
  ok("EXIST: у вина с названием снимок не запускает AI сам; есть «Заполнить по этикетке»", !ai.some((b) => b.mode === "label") && (await o.page.locator("[data-wine-label]").count()) === 1, JSON.stringify(ai.map((b) => b.mode)));
  await o.page.locator("[data-wine-label]").click();
  await until(async () => (await o.page.locator("[data-wine-ai]").count()) > 0, 6000);
  const f = await o.page.evaluate(() => ({ vintage: document.querySelector('[data-wine-field="vintage"]').value, abv: document.querySelector('[data-wine-field="abv"]').value, volume: document.querySelector('[data-wine-field="volume"]').value, producer: document.querySelector('[data-wine-field="producer"]').value }));
  ok("EXIST: «Заполнить по этикетке» — только пустые поля (крепость, объём), вписанное не тронуто", f.abv === "12.5" && f.volume === "0,75 л" && f.producer === "Domaine Laroche" && f.vintage === "2022", JSON.stringify(f));
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  const w = wines(srv).find((x) => x.id === "w-cha");
  ok("EXIST: сохранено — фото у «Шабли», остальное прежнее", !!w && w.img === PHOTO_HOST + "/dva-morya/w-cha-1.jpg" && w.priceBottle === 5200 && w.name === "Шабли", JSON.stringify(w && { img: w.img, price: w.priceBottle }));
  // «Убрать» — фото снято
  await o.page.locator('[data-wine-erow="w-cha"] [role="button"]').click(); await sleep(500);
  await o.page.locator("[data-wine-pic-del]").click(); await sleep(200);
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  ok("EXIST: «Убрать» и «Сохранить» — у вина больше нет фото", (wines(srv).find((x) => x.id === "w-cha") || {}).img === "");
  const [e1, e2] = noErr(o); ok("EXIST: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("BOTTLES", async () => {
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P });
  const ai = [], up = [];
  const queue = [LABEL.gavi, LABEL.chablis, LABEL.pinot, null];
  await o.ctx.route("**/api/wine-import", async (route) => {
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    ai.push(b); await sleep(350);
    const next = queue.shift();
    return route.fulfill({ status: next ? 200 : 422, contentType: "application/json", body: JSON.stringify(next ? { wines: [next] } : { error: "Этикетку не прочитать" }) });
  });
  await photoRoutes(o.ctx, up);
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator("[data-wine-import-open]").click(); await sleep(300);
  const opt = await txt(o.page.locator('[data-wine-imp="bottles"]'));
  ok("BOTTLES: в «Импорте» первым — «Фото бутылок»", /^Фото бутылок/.test(opt) && (await o.page.locator("[data-wine-imp]").first().getAttribute("data-wine-imp")) === "bottles", opt);
  await o.page.setInputFiles("[data-wine-bottles-input]", [shotFile(1), shotFile(2), shotFile(3), shotFile(4)]);
  let seen = "";
  await until(async () => { const t = await txt(o.page.locator('[data-wine-import="work"]')); if (t) seen = t; return /Читаю этикетку: 2 из 4/.test(t); }, 5000, 60);
  ok("BOTTLES: идёт чтение — «Читаю этикетку: 2 из 4» (по одной, а не пачками по 15)", /Читаю этикетку: 2 из 4/.test(seen), seen);
  await until(() => o.page.locator('[data-wine-import="review"]').count(), 9000);
  const rows = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-bottle-row]")].map((r) => ({ plan: r.getAttribute("data-wine-plan"), keep: r.querySelector("input").checked,
    t: r.innerText.replace(/\s+/g, " ").slice(0, 120), img: !!r.querySelector("img") })));
  const head = await txt(o.page.locator("[data-wine-found]"));
  ok("BOTTLES: обзор — три прочитанных с миниатюрами: новое (отмечено), «Шабли» без фото — фото добавится (отмечено), «Пино Нуар» с фото — не отмечено",
    rows.length === 3 && rows.every((r) => r.img) && rows.map((r) => r.plan).join(",") === "new,attach,replace" && rows.map((r) => r.keep).join(",") === "true,true,false"
      && /фото и пустые поля с этикетки добавятся к нему/.test(rows[1].t) && /отметь, чтобы заменить фото/.test(rows[2].t), JSON.stringify(rows));
  ok("BOTTLES: в шапке — сколько прочитано, сколько уже в карте и на каком снимке этикетку не прочитать", /Прочитано 3 вина, уже в карте: 2/.test(head) && /Этикетку не прочитать на 1 снимке/.test(head), head);
  ok("BOTTLES: кнопка — «Сохранить 2 вина»", (await txt(o.page.locator("[data-wine-add]"))) === "Сохранить 2 вина");
  await shot(o.page, "bottles-review");
  await o.page.locator("[data-wine-add]").click();
  await until(async () => wines(srv).some((x) => x.name === "Гави ди Гави"), 8000);
  await sleep(600);
  const g = wines(srv).find((x) => x.name === "Гави ди Гави"), s = wines(srv).find((x) => x.id === "w-cha"), p = wines(srv).find((x) => x.id === "w-pin");
  ok("BOTTLES: сохранено — Гави новым вином с фото, «Шабли» получил фото, «Пино Нуар» не тронут; фото ушло два раза",
    !!g && /^https:\/\/photos\.e2e\/dva-morya\/wn-/.test(g.img) && !!s && s.img === PHOTO_HOST + "/dva-morya/w-cha-2.jpg" && s.name === "Шабли" && p.img === PHOTO_HOST + "/seed/pin.jpg" && up.length === 2 && wines(srv).length === 7,
    JSON.stringify({ g: g && g.img, s: s && s.img, p: p && p.img, up: up.map((x) => x.id), n: wines(srv).length }));
  const msg = await txt(o.page.locator('[role="status"]').last());
  ok("BOTTLES: итог — «Сохранено: 2 вина»", /Сохранено: 2 вина/.test(msg), msg);
  const [e1, e2] = noErr(o); ok("BOTTLES: без ошибок", e1, e2);
  await o.ctx.close();
});

// длинная карта в PDF (владелец: «У меня редактор pdf-ку не принял»): ответ оборвался — продолжение с after; дополнить AI
const PDF_ROWS = [{ name: "Шампанское Brut Réserve", producer: "Charles Heidsieck", priceBottle: 14500, color: "sparkling" }, { name: "Гави ди Гави", producer: "La Scolca", priceGlass: 820, priceBottle: 4600, byGlass: true, color: "white" },
  { name: "Альбариньо", producer: "Pazo Señorans", priceBottle: 5400, color: "white" }, { name: "Риоха Резерва", producer: "Muga", priceBottle: 5900, color: "red" }, { name: "Бароло", producer: "Pio Cesare", priceBottle: 12800, color: "red" }];
await run("PDF", async () => {
  for (const failMid of [false, true]) {
    const srv = srvOf(MENU_P);
    const o = await open({ who: MARIA, srv, menu: MENU_P });
    const ai = [];
    await o.ctx.route("**/api/wine-import", async (route) => {
      let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      ai.push({ mode: b.mode, after: b.after || "", names: b.names || null }); await sleep(400);
      const J = (x, st = 200) => route.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(x) });
      if (b.mode === "pdf" && !b.after) return J({ wines: PDF_ROWS.slice(0, 3), cut: true });
      if (b.mode === "pdf") return failMid ? J({ error: "Ошибка OpenRouter: timeout" }, 502) : J({ wines: PDF_ROWS.slice(2), cut: false });   // «Альбариньо» — повтор
      if (b.mode === "names") return J({ wines: b.names.map((n) => ({ name: n, notes: ["цитрус", "минеральность"], short: "Свежо и ярко", temp: "8–10 °C" })) });
      return J({ wines: [] });
    });
    await hideToasts(o.page);
    await toEditor(o.page);
    await o.page.locator("[data-wine-import-open]").click(); await sleep(300);
    await o.page.setInputFiles('input[accept="application/pdf"]', { name: "carta.pdf", mimeType: "application/pdf", buffer: PDF });
    let seen = "";
    await until(async () => { const t = await txt(o.page.locator('[data-wine-import="work"]')); if (t) seen = t; return /прочитано 3 вина/.test(t); }, 6000, 60);
    await until(() => o.page.locator('[data-wine-import="review"]').count(), 9000);
    const names = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-found-row]")].map((r) => r.innerText.split("\n")[0].replace(/ · уже в карте$/, "")));
    const note = await txt(o.page.locator("[data-wine-imp-note]"));
    const pdfCalls = ai.filter((x) => x.mode === "pdf");
    if (!failMid) {
      ok("PDF: ответ оборвался — ещё заход «после «Альбариньо»», пока читаю — «Читаю PDF, прочитано 3 вина»; повтор не задвоился",
        pdfCalls.length === 2 && pdfCalls[1].after === "Альбариньо" && /Читаю PDF, прочитано 3 вина/.test(seen) && names.length === 5 && new Set(names).size === 5 && !note, JSON.stringify({ pdfCalls, seen, names, note }));
      await shot(o.page, "pdf-review");
      await o.page.locator("[data-wine-enrich]").click();
      await until(() => o.page.locator("[data-wine-enriched]").count(), 8000);
      const nm = ai.filter((x) => x.mode === "names");
      ok("PDF: «Дополнить ноты и подачу через AI» — один запрос на пять названий, в обзоре — «дописаны AI»", nm.length === 1 && nm[0].names.length === 5 && (await o.page.locator("[data-wine-enrich]").count()) === 0,
        JSON.stringify(nm));
      await o.page.locator("[data-wine-add]").click(); await sleep(1500);
      const b = wines(srv).find((x) => x.name === "Бароло");
      ok("PDF: добавлено — у вин цена из карты и ноты от AI (с пометкой «не проверено»)", !!b && b.priceBottle === 12800 && (b.notes || []).length === 2 && (b.ai || []).includes("notes") && wines(srv).length === 11, JSON.stringify(b && { p: b.priceBottle, n: b.notes, ai: b.ai, total: wines(srv).length }));
    } else {
      ok("PDF: продолжение не удалось — прочитанные 3 вина в обзоре, и сказано, что дочитать не получилось", names.length === 3 && /Дочитать не получилось: Ошибка OpenRouter: timeout\. Прочитанное можно добавить/.test(note), JSON.stringify({ names, note }));
    }
    const [e1, e2] = noErr(o); ok(`PDF${failMid ? " (обрыв)" : ""}: без ошибок`, e1, e2);
    await o.ctx.close();
  }
});

// «Верно для всех в списке» (владелец: «Да, давай добавим»): только в «Не проверено», с переспросом; с поиском — найденное
await run("BULK", async () => {
  const menu = MENU_P.map((d) => (d && d.id === "w-chi" ? { ...d, ai: ["grapes"] } : d));
  const srv = srvOf(menu);
  const o = await open({ who: MARIA, srv, menu });
  await hideToasts(o.page);
  await toEditor(o.page);
  const before = await o.page.locator("[data-wine-ok-all]").count();
  await o.page.locator('[data-wine-filter="unchecked"]').click(); await sleep(300);
  const t0 = await txt(o.page.locator("[data-wine-ok-all]"));
  ok("BULK: кнопка только в «Не проверено» — «Верно для всех в списке: 2»", before === 0 && t0 === "Верно для всех в списке: 2", JSON.stringify({ before, t0 }));
  await o.page.locator('input[type="search"]').fill("Розе"); await sleep(300);
  await o.page.locator("[data-wine-ok-all]").click(); await sleep(200);
  const t1 = await txt(o.page.locator("[data-wine-ok-all]"));
  const still = (wines(srv).find((x) => x.id === "w-ros") || {}).ai || [];
  ok("BULK: с поиском — одно вино; первое касание только переспрашивает", t1 === "Подтвердить все 1? Коснись ещё раз" && still.length > 0, JSON.stringify({ t1, still }));
  await o.page.locator("[data-wine-ok-all]").click(); await sleep(1500);
  const ros = wines(srv).find((x) => x.id === "w-ros"), chi = wines(srv).find((x) => x.id === "w-chi");
  const allOn = await o.page.locator('[data-wine-filter="all"]').getAttribute("aria-pressed");
  ok("BULK: второе касание — «Розе» проверено (кем), «Кьянти» не тронут; список снова «Все»", ros.ai.length === 0 && ros.checkedBy === "Мария Ким" && chi.ai.length === 1 && allOn === "true", JSON.stringify({ ros: ros.ai, by: ros.checkedBy, chi: chi.ai, allOn }));
  await o.page.locator('input[type="search"]').fill(""); await sleep(200);
  await o.page.locator('[data-wine-filter="unchecked"]').click(); await sleep(300);
  await o.page.locator("[data-wine-ok-all]").click(); await sleep(150);
  await o.page.locator("[data-wine-ok-all]").click(); await sleep(1500);
  const msg = await txt(o.page.locator('[role="status"]').last());
  ok("BULK: оставшееся — тоже; в итоге «Проверено: 1 вино», не проверенных нет", wines(srv).every((x) => !(x.ai || []).length) && /Проверено: 1 вино/.test(msg) && (await o.page.locator('[data-wine-filter="unchecked"]').count()) === 0, msg);
  const [e1, e2] = noErr(o); ok("BULK: без ошибок", e1, e2);
  await o.ctx.close();
});

// «закрыть» в линзе (владелец: «Мне кажется или крестик не оцентрован, да и круги тоже»): крест — маской по центру кружка,
// буква «×» не видна (она сидела ниже середины); кольцо и кружок — одного центра
// под нагрузкой лист импорта ещё въезжает: ждём, пока кружок встанет на место, и снимаем ещё раз, если креста не видно
const crossAt = async (page, sel) => {
  let c = null;
  for (let i = 0; i < 5; i++) {
    await until(async () => { const a = await page.evaluate((sel) => { const x = document.querySelector(sel); if (!x) return ""; const b = x.getBoundingClientRect(); return b.left + "," + b.top; }, sel); await sleep(120);
      const b = await page.evaluate((sel) => { const x = document.querySelector(sel); if (!x) return ""; const b = x.getBoundingClientRect(); return b.left + "," + b.top; }, sel); return a && a === b; }, 4000, 50);
    c = await crossOnce(page, sel);
    if (!c || c.n > 10) return c;
    await sleep(400);
  }
  return c;
};
const crossOnce = async (page, sel) => {
  const r = await page.evaluate((sel) => { const x = document.querySelector(sel); if (!x) return null; x.scrollIntoView({ block: "center" }); const b = x.getBoundingClientRect(), s = getComputedStyle(x), bf = getComputedStyle(x, "::before"), af = getComputedStyle(x, "::after");
    const ab = { l: parseFloat(af.left), t: parseFloat(af.top), r: parseFloat(af.right), b: parseFloat(af.bottom) };
    return { l: b.left, t: b.top, w: b.width, h: b.height, fs: s.fontSize, before: bf.content, mask: (bf.webkitMaskImage || bf.maskImage || "").slice(0, 30), ring: af.content !== "none" ? [af.left, af.top, af.right, af.bottom].join(" ") : "" }; }, sel);
  if (!r) return null;
  await sleep(150);
  // v125: снимок — от целого пикселя, центр кружка — по его месту (кнопка на дробной высоте, например 628,28 px, иначе
  // сдвигала середину снимка на долю пикселя, и крест «уезжал» на 0,75 px, хотя стоит ровно)
  const pad = 8, X0 = Math.floor(r.l - pad), Y0 = Math.floor(r.t - pad), CW = Math.ceil(r.l + r.w + pad) - X0, CH = Math.ceil(r.t + r.h + pad) - Y0;
  const buf = await page.screenshot({ clip: { x: X0, y: Y0, width: CW, height: CH } });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels, k = W / CW, cx = (r.l + r.w / 2 - X0) * k, cy = (r.t + r.h / 2 - Y0) * k, R = (r.w / 2) * k;
  const xs = [], ys = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * ch, lum = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    if (lum > 120 && Math.hypot(x - cx, y - cy) < R * 0.5) { xs.push(x); ys.push(y); } }
  const mid = (a) => (Math.min(...a) + Math.max(...a)) / 2;
  return { ...r, n: xs.length, dx: xs.length ? +((mid(xs) - cx) / k).toFixed(2) : null, dy: ys.length ? +((mid(ys) - cy) / k).toFixed(2) : null, size: xs.length ? +((Math.max(...xs) - Math.min(...xs)) / k).toFixed(1) : 0 };
};
await run("CROSS", async () => {
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P });
  await hideToasts(o.page);
  await until(() => o.page.locator("[data-track-chip]").count(), 9000); await sleep(600);
  await o.page.evaluate(() => { const b = document.querySelector('[data-track-chip="core"]'); b.scrollIntoView({ block: "center" }); b.click(); }); await sleep(800);
  const a = await crossAt(o.page, "[data-track-close]");
  await toEditor(o.page);
  await o.page.locator("[data-wine-import-open]").click(); await sleep(400);
  const b = await crossAt(o.page, '[data-wine-import] [data-lens-x]');
  // v125: допуск ±0,75 px — доли пикселя самого браузера: крест 8,5 px на экране ×2 (17 точек) ставится по центру с
  // округлением на четверть пикселя, а кнопка на дробной высоте (628,28 px; зависит от дня на главной) — ещё до половины
  const good = (c) => !!c && c.fs === "0px" && c.before === '""' && /svg/.test(c.mask) && c.ring === "-3.5px -3.5px -3.5px -3.5px" && c.n > 10 && Math.abs(c.dx) <= 0.75 && Math.abs(c.dy) <= 0.75 && c.size >= 7 && c.size <= 10;
  ok("CROSS: «свернуть» панели трека и «закрыть» импорта — крест по центру кружка (±0,75 px), буквы нет, кольцо вокруг того же центра", good(a) && good(b), JSON.stringify([a, b]));
  const [e1, e2] = noErr(o); ok("CROSS: без ошибок", e1, e2);
  await o.ctx.close();
});

// линза и «Для чтения»: блок фото — карточка, кнопки — стекло с подписью золотом; миниатюры; контраст
const lensChecks = async (tag, light) => {
  const P = pal(light);
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P, light });
  const ai = [], up = [];
  await aiRoute(o.ctx, ai, labelAi([]));
  await photoRoutes(o.ctx, up);
  await hideToasts(o.page);
  await toEditor(o.page);
  await o.page.locator('[data-wine-erow="w-pin"] [role="button"]').click(); await sleep(500);
  const card = await st(o.page, "[data-wine-photo]"), take = await st(o.page, "[data-wine-pic-take]"), del = await st(o.page, "[data-wine-pic-del]");
  ok(`${tag}: блок «Фото бутылки» — карточка линзы, «Заменить» и «Убрать» — стекло`, !!card && /radial-gradient/.test(card.img) && card.bc === P.EDGE && !!take && take.bg === P.GLASS && !!del && del.bg === P.GLASS, JSON.stringify([card, take, del]).slice(0, 300));
  if (light) {
    const low = await pxAll(o.page, ["[data-wine-pic-take]", "[data-wine-pic-del]", "[data-wine-pic-note]"]);
    ok(`${tag}: подписи блока читаются (контраст по пикселям)`, !low.length, JSON.stringify(low));
  }
  await shot(o.page, (light ? "paper-" : "lens-") + "form");
  await o.page.locator("[data-lens=\"back\"]").first().click(); await sleep(400);
  const la = await lightAudit(o.page);
  ok(`${tag}: свет карточек не съедает подписи в списке редактора`, !la.out.length, JSON.stringify(la.out));
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LENS", () => lensChecks("LENS", false));
await run("PAPER", () => lensChecks("PAPER", true));

await run("NOW", async () => {
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P, seedExtra: { sa_home_look: "now" } });
  await hideToasts(o.page);
  await toList(o.page); await sleep(1300);
  const row = await st(o.page, "[data-wine-row]");
  const thumbs = await o.page.locator("[data-wine-row] [data-wine-thumb]").count();
  ok("NOW: вид «как сейчас» — миниатюры на месте, карточки без света линзы", thumbs === 5 && !!row && !/radial-gradient/.test(row.img), JSON.stringify({ thumbs, img: row && row.img }));
  await shot(o.page, "now-list");
  await o.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf(MENU_P);
  const o = await open({ who: MARIA, srv, menu: MENU_P, w: 320, h: 700 });
  const ai = [], up = [];
  await aiRoute(o.ctx, ai, labelAi([LABEL.gavi, LABEL.chablis]));
  await photoRoutes(o.ctx, up);
  await hideToasts(o.page);
  await toEditor(o.page);
  const f1 = await fits(o.page);
  await o.page.locator("[data-wine-new]").click(); await sleep(400);
  await o.page.setInputFiles("[data-wine-pic-input]", shotFile());
  await until(async () => /Фото загружено/.test(await txt(o.page.locator("[data-wine-pic-note]"))), 6000); await sleep(300);
  const f2 = await fits(o.page);
  await shot(o.page, "narrow-form");
  await o.page.locator("[data-wine-save]").click(); await sleep(1500);
  await o.page.locator("[data-wine-import-open]").click(); await sleep(300);
  await o.page.setInputFiles("[data-wine-bottles-input]", [shotFile(1)]);
  await until(() => o.page.locator('[data-wine-import="review"]').count(), 8000);
  const f3 = await fits(o.page);
  await shot(o.page, "narrow-review");
  ok("NARROW: 320 px — список, форма с фото и обзор бутылок без сдвига вбок", f1.sw <= f1.W && f2.sw <= f2.W && f3.sw <= f3.W, JSON.stringify([f1, f2, f3]));
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
