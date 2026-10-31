// e2e v120 (Доп. 433): «Винная карта» и умный «Редактор вин». Владелец (31.10): «Вин более 140 позиций… PDF, к сожалению,
// нет. Но возможность добавления его нужно оставить» и «Сделаем такой же умный редактор, чтобы не только AI добавлял, а ещё и
// человек ручками всё это мог добавить». Сервер — tools/claude/demo-app/fake-server.js (вина — записи kind:"wine" в меню
// команды), AI — /api/wine-import своими ответами. Разделы:
//   LIST   — «Справочник» → «Наша винная карта»: группы, «Бокалом», поиск, карточка вина, «не проверено»; у сотрудника нет
//            «Редактора», у пустой карты сотрудник не видит входа, руководитель видит «Пока пусто»;
//   EDIT   — руками: новое вино со всеми полями → в меню команды без пометок AI; «Заполнить по названию» — только пустые
//            поля, с пометкой AI; правка поля руками снимает пометку; «Верно» в списке — подтверждено; архив, удаление;
//   IMPORT — списком (20 названий → два запроса по 15 и 5, повтор с картой — без отметки), фото страницы, PDF, ошибка AI;
//   KEEP   — тренажёр меню: вин нет среди блюд; стоп-лист и «Опубликовать» не стирают вина;
//   LENS   — строки — карточки, «＋ Новое вино» и «Сохранить» — плашки, поля — стекло;
//   PAPER  — «Для чтения»: контраст по пикселям; NOW — вид «как сейчас» без линзы; NARROW — 320 px.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] [E2E_LOOK=now] node e2e-v120.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v120";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v120";
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

await run("LIST", async () => {
  const srv = srvOf(MENU_W);
  const a = await open({ who: ANNA, srv, menu: MENU_W });
  await hideToasts(a.page);
  await go(a.page, "reference", 1800);
  const cardTxt = await txt(a.page.locator('[data-ref-card="winelist"]'));
  ok("LIST: в «Справочнике» — «Наша винная карта · 5 вин · бокалом 3» (архив не считается)", /Наша винная карта 5 вин · бокалом 3/.test(cardTxt), cardTxt);
  await clickText(a.page, "[data-ref-card]", "Наша винная карта"); await sleep(1500);
  const sum = await txt(a.page.locator("[data-wine-sum]"));
  const groups = await a.page.evaluate(() => [...document.querySelectorAll("[data-wine-group]")].map((g) => g.getAttribute("data-wine-group")).join(","));
  ok("LIST: «5 вин · бокалом 3» (у сотрудника без «не проверено»), группы по цвету в порядке карты", sum === "5 вин · бокалом 3" && groups === "sparkling,white,rose,red", sum + " | " + groups);
  ok("LIST: у сотрудника нет «Редактора»", !(await a.page.locator("[data-wine-edit]").count()));
  await shot(a.page, "list");
  await a.page.locator('[data-wine-only="glass"]').click(); await sleep(300);
  const glassRows = await a.page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((r) => r.getAttribute("data-wine-row")).join(","));
  ok("LIST: «Бокалом» — только вина бокалом", glassRows === "w-pro,w-cha,w-pin", glassRows);
  await a.page.locator('[data-wine-only="all"]').click(); await sleep(200);
  await a.page.locator('input[type="search"]').fill("шардоне мел"); await sleep(300);
  const found = await a.page.evaluate(() => [...document.querySelectorAll("[data-wine-row]")].map((r) => r.getAttribute("data-wine-row")).join(","));
  ok("LIST: поиск по сорту и нотам", found === "w-cha", found);
  await a.page.locator('input[type="search"]').fill(""); await sleep(200);
  await a.page.locator('[data-wine-row="w-cha"]').click(); await sleep(600);
  const card = await txt(a.page.locator('[data-wine-card="w-cha"]'));
  ok("LIST: карточка вина — производитель, стиль, цена, фраза гостю, ноты, подача, о вине, к блюдам",
    /Domaine Laroche/.test(card) && /Франция, Бургундия · шардоне · белое сухое/.test(card) && /бокал 950 ₽ · бутылка 5 200 ₽/.test(card) && /«Свежее и минеральное: к морепродуктам\.»/.test(card)
    && /зелёное яблоко/.test(card) && /8–10 °C · бокал «бургундия»/.test(card) && /Шардоне без дуба/.test(card) && /Закуска из морепродуктов/.test(card), card.slice(0, 400));
  await shot(a.page, "card");
  await a.page.locator('[data-lens="back"]').first().click(); await sleep(500);
  await a.page.locator('[data-wine-row="w-ros"]').click(); await sleep(500);
  const un = await txt(a.page.locator("[data-wine-unchecked]"));
  ok("LIST: вино с полями от AI — «Не проверено: сорт, ноты, фраза гостю»", /^Не проверено: сорт, ноты, фраза гостю\./.test(un), un);
  const [e1, e2] = noErr(a); ok("LIST: без ошибок", e1, e2);
  await a.ctx.close();
  // пустая карта: сотрудник входа не видит, руководитель — видит и может начать
  const srv2 = srvOf(MENU);
  const b = await open({ who: ANNA, srv: srv2 });
  await hideToasts(b.page); await go(b.page, "reference", 1800);
  ok("LIST: пустая карта — у сотрудника входа нет", !(await b.page.locator('[data-ref-card="winelist"]').count()));
  await b.ctx.close();
  const m = await open({ who: MARIA, srv: srvOf(MENU) });
  await hideToasts(m.page); await go(m.page, "reference", 1800);
  const mt = await txt(m.page.locator('[data-ref-card="winelist"]'));
  ok("LIST: пустая карта — у руководителя «Пока пусто: добавь вина»", /Пока пусто: добавь вина/.test(mt), mt);
  await m.page.locator('[data-ref-card="winelist"]').click(); await sleep(1200);
  ok("LIST: в пустой карте руководителю — «Добавить вина»", (await m.page.locator('[data-lens-btn="main"]').filter({ hasText: "Добавить вина" }).count()) === 1);
  await m.ctx.close();
});

await run("EDIT", async () => {
  const srv = srvOf(MENU_W), calls = [];
  const a = await open({ who: MARIA, srv, menu: MENU_W });
  await aiRoute(a.ctx, calls, ANSWER);
  await hideToasts(a.page);
  await toList(a.page); await sleep(1400);
  await a.page.locator("[data-wine-edit]").click(); await sleep(1500);
  ok("EDIT: «Редактор вин» — 5 вин, не проверено 1, в архиве 1", /^5 вин · бокалом 3 · не проверено 1 · в архиве 1$/.test(await txt(a.page.locator("[data-wine-editor] > div:nth-of-type(2) > div").first())), await txt(a.page.locator("[data-wine-editor]")));
  await a.page.locator("[data-wine-new]").click(); await sleep(400);
  const f = (k, v) => a.page.locator(`[data-wine-field="${k}"]`).fill(v);
  await f("name", "Гави ди Гави"); await f("producer", "La Scolca"); await f("country", "Италия"); await f("region", "Пьемонт"); await f("grapes", "кортезе"); await f("vintage", "2022");
  await a.page.locator('[data-wine-color="white"]').click(); await clickText(a.page, "button", "сухое"); await a.page.locator("[data-wine-glass]").click(); await sleep(150);
  await f("priceGlass", "820"); await f("priceBottle", "4600"); await f("temp", "8–10 °C"); await f("notes", "груша, миндаль"); await f("short", "Свежее белое из Пьемонта.");
  await clickText(a.page, "button", "Закуска из морепродуктов");
  await shot(a.page, "form");
  await a.page.locator("[data-wine-save]").click(); await sleep(1200);
  const g = wines(srv).find((w) => w.name === "Гави ди Гави");
  ok("EDIT: новое вино руками — в меню команды со всеми полями и без пометок AI",
    !!g && g.producer === "La Scolca" && g.color === "white" && g.sweet === "сухое" && g.byGlass === true && g.priceGlass === 820 && g.priceBottle === 4600 && g.grapes.join() === "кортезе" && g.notes.join() === "груша,миндаль"
    && g.pair.length === 1 && g.ai.length === 0 && wines(srv).length === 7, JSON.stringify(g));
  ok("EDIT: блюда и коктейли меню на месте", (srv.S.menu || []).filter((d) => d && !d.kind).length === MENU.filter((d) => d && !d.kind).length);
  // по названию: только пустые поля, с пометкой
  await a.page.locator("[data-wine-new]").click(); await sleep(400);
  await f("name", "Бароло Pio Cesare 2018"); await f("region", "Ланге");
  await a.page.locator("[data-wine-fill]").click(); await sleep(900);
  const reg = await a.page.locator('[data-wine-field="region"]').inputValue(), grp = await a.page.locator('[data-wine-field="grapes"]').inputValue();
  const tags = await a.page.locator("[data-wine-ai]").count();
  ok("EDIT: «Заполнить по названию» — запрос fill, вписанный регион не тронут, пустые поля заполнены с пометкой AI", calls.length === 1 && calls[0].mode === "fill" && calls[0].name === "Бароло Pio Cesare 2018" && reg === "Ланге" && grp === "неббиоло" && tags >= 5 && (await shown(a.page, "[data-wine-check]")), JSON.stringify({ calls, reg, grp, tags }));
  await shot(a.page, "form-ai");
  await f("grapes", "неббиоло, барбера"); await sleep(100);
  await a.page.locator("[data-wine-save]").click(); await sleep(1200);
  const b = wines(srv).find((w) => /^Бароло/.test(w.name));
  ok("EDIT: исправленный руками сорт — проверен, остальное от AI ждёт проверки", !!b && !b.ai.includes("grapes") && b.ai.includes("country") && b.ai.includes("notes") && b.grapes.join() === "неббиоло,барбера", JSON.stringify(b && b.ai));
  const okBtn = a.page.locator(`[data-wine-ok="${b && b.id}"]`);
  ok("EDIT: в списке у него — «AI: …» и «Верно»", (await okBtn.count()) === 1);
  await okBtn.click(); await sleep(1100);
  const b2 = wines(srv).find((w) => w.id === (b && b.id));
  ok("EDIT: «Верно» — подтверждено (кто и когда)", !!b2 && b2.ai.length === 0 && b2.checkedBy === "Мария Ким" && b2.checkedAt > 0, JSON.stringify(b2 && { ai: b2.ai, by: b2.checkedBy }));
  // архив и удаление (со второго касания)
  await a.page.locator('[data-wine-erow="w-chi"] [role="button"]').click(); await sleep(400);
  await clickText(a.page, "button", "В архив"); await sleep(1100);
  ok("EDIT: «В архив» — вино в архиве, из карты ушло", wines(srv).find((w) => w.id === "w-chi").archived === true);
  await a.page.locator('[data-wine-filter="archive"]').click(); await sleep(300);
  await a.page.locator('[data-wine-erow="w-old"] [role="button"]').click(); await sleep(400);
  await a.page.locator("[data-wine-del]").click(); await sleep(200);
  const askDel = await txt(a.page.locator("[data-wine-del]"));
  await a.page.locator("[data-wine-del]").click(); await sleep(1100);
  ok("EDIT: «Удалить» — со второго касания («Удалить насовсем?»)", askDel === "Удалить насовсем?" && !wines(srv).some((w) => w.id === "w-old"), askDel);
  const [e1, e2] = noErr(a); ok("EDIT: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("IMPORT", async () => {
  const srv = srvOf(MENU_W), calls = [];
  const a = await open({ who: MARIA, srv, menu: MENU_W });
  await aiRoute(a.ctx, calls, ANSWER);
  await hideToasts(a.page);
  await go(a.page, "wineEditor", 2000);
  await a.page.locator("[data-wine-import-open]").click(); await sleep(300);
  await shot(a.page, "import");
  await a.page.locator('[data-wine-imp="text"]').click(); await sleep(200);
  const names = ["1. Шабли — 5 200 ₽", ...Array.from({ length: 19 }, (_, i) => "• Вино номер " + (i + 1) + " 2021 0,75 л")];
  await a.page.locator("[data-wine-paste]").fill(names.join("\n")); await a.page.locator("[data-wine-parse]").click(); await sleep(300);
  ok("IMPORT: «Разобрать» — 20 названий (номера, маркеры, цены и объёмы отрезаны)", (await a.page.locator("[data-wine-names]").getAttribute("data-wine-names")) === "20");
  await a.page.locator("[data-wine-ai-go]").click();
  ok("IMPORT: AI дополняет двумя запросами (15 и 5)", await until(() => shown(a.page, '[data-wine-import="review"]'), 8000) && calls.filter((c) => c.mode === "names").map((c) => c.names.length).join() === "15,5", JSON.stringify(calls.map((c) => c.mode + ":" + (c.names || []).length)));
  const rows = await a.page.locator("[data-wine-found-row]").count();
  const dupOff = await a.page.locator('[data-wine-found-row="0"] input').isChecked();
  ok("IMPORT: на проверку — 20 вин, «Шабли» (уже в карте) — без отметки", rows === 20 && dupOff === false && /уже в карте: 1/.test(await txt(a.page.locator("[data-wine-found]"))), String(rows) + " " + dupOff);
  await shot(a.page, "review");
  await a.page.locator("[data-wine-add]").click(); await sleep(1300);
  const added = wines(srv).filter((w) => /^Вино номер/.test(w.name));
  ok("IMPORT: добавлено 19 вин, у каждого поля от AI помечены (сорт, регион…), название — как в списке", added.length === 19 && added.every((w) => w.ai.includes("grapes") && w.ai.includes("region") && !w.ai.includes("name")) && added[0].name === "Вино номер 1 2021", JSON.stringify(added[0]));
  // фото страницы и PDF
  await a.page.locator("[data-wine-import-open]").click(); await sleep(300);
  // v122: рядом — ввод «Фото бутылок» (тоже image/*); здесь — снимок страницы карты
  await a.page.locator('input[type="file"][accept="image/*"]:not([data-wine-bottles-input])').setInputFiles(OUT + "/in/page.jpg");
  await until(() => shown(a.page, '[data-wine-import="review"]'), 8000);
  const ph = calls.filter((c) => c.mode === "photo");
  ok("IMPORT: фото страницы — снимок JPEG в запросе, на проверку — 3 вина", ph.length === 1 && ph[0].mime === "image/jpeg" && ph[0].imageBase64.length > 100 && (await a.page.locator("[data-wine-found-row]").count()) === 3, JSON.stringify(ph.map((c) => c.mime)));
  await a.page.locator("[data-wine-add]").click(); await sleep(1300);
  const gv = wines(srv).find((w) => w.name === "Гави ди Гави");
  ok("IMPORT: с листа — цены и «бокалом» (помечены AI: прочитаны с фото)", !!gv && gv.byGlass && gv.priceGlass === 820 && gv.ai.includes("priceGlass"), JSON.stringify(gv));
  await a.page.locator("[data-wine-import-open]").click(); await sleep(300);
  await a.page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(OUT + "/in/carta.pdf");
  await until(() => shown(a.page, '[data-wine-import="review"]'), 8000);
  ok("IMPORT: PDF — файлом в запросе, «Бароло» и «Гави» уже в карте", calls.some((c) => c.mode === "pdf" && c.pdfBase64.length > 10) && /уже в карте: 2/.test(await txt(a.page.locator("[data-wine-found]"))));
  await a.page.locator('[aria-label="Закрыть импорт"]').click(); await sleep(200);
  // ошибка AI — понятным текстом, руками работать можно
  await a.ctx.unroute("**/api/wine-import");
  await aiRoute(a.ctx, calls, () => ({ status: 500, body: { error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables → Add (после добавления нужен Redeploy)." } }));
  await a.page.locator("[data-wine-new]").click(); await sleep(300);
  await a.page.locator('[data-wine-field="name"]').fill("Тест"); await a.page.locator("[data-wine-fill]").click(); await sleep(700);
  ok("IMPORT: без ключа AI — понятная ошибка, форма остаётся", /OPENROUTER_API_KEY не задан/.test(await txt(a.page.locator('[data-wine-form] [role="alert"]'))));
  const [e1, e2] = noErr(a); ok("IMPORT: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("KEEP", async () => {
  const srv = srvOf(MENU_W);
  const a = await open({ who: MARIA, srv, menu: MENU_W });
  await hideToasts(a.page);
  await go(a.page, "menuTrainer", 2200);
  const body = await a.page.evaluate(() => document.body.innerText);
  ok("KEEP: в тренажёре меню вин нет среди блюд", !/Шабли|Просекко DOC|Пино Нуар/.test(body));
  await clickText(a.page, ".sa-card", "Редактор меню"); await sleep(1800);
  const before = wines(srv).length, sets0 = srv.calls.filter((c) => c.fn === "menu_set").length;
  const st = await a.page.evaluate(() => { const b = [...document.querySelectorAll("span, button")].find((x) => x.textContent.trim() === "В стоп" && x.offsetParent !== null); if (b) { b.scrollIntoView({ block: "center" }); b.click(); return true; } return false; });
  await sleep(1600);
  const sets = srv.calls.filter((c) => c.fn === "menu_set").length - sets0;
  const stopped = (srv.S.menu || []).filter((d) => d && !d.kind && d.stop).length;
  ok("KEEP: блюдо в стоп (меню уходит команде целиком) — вина на месте", st && sets >= 1 && stopped >= 1 && before === 6 && wines(srv).length === 6, JSON.stringify({ st, sets, stopped, before, after: wines(srv).length }));
  const [e1, e2] = noErr(a); ok("KEEP: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("LENS", async () => {
  const srv = srvOf(MENU_W);
  const a = await open({ who: MARIA, srv, menu: MENU_W });
  await hideToasts(a.page);
  await toList(a.page); await sleep(1400);
  const row = await st(a.page, "[data-wine-row]"), q = await st(a.page, 'input[type="search"]'), on = await st(a.page, '[data-wine-only="all"]'), ed = await st(a.page, "[data-wine-edit]");
  const refc = await st(a.page, "[data-wine-row]");
  ok("LENS: карта — строки карточками, поиск — стекло, выбранный фильтр — плашка, «Редактор» — стекло", lensCard(row) && !!q && q.bg === GLASS && isTab(on) && isSoft(ed), JSON.stringify([row, q, on, ed]));
  await a.page.locator("[data-wine-edit]").click(); await sleep(1500);
  const nw = await st(a.page, "[data-wine-new]"), im = await st(a.page, "[data-wine-import-open]"), er = await st(a.page, "[data-wine-erow]");
  ok("LENS: редактор — «＋ Новое вино» плашка, «Импорт» стекло, строки — карточки", isMain(nw) && isSoft(im) && lensCard(er), JSON.stringify([nw, im, er]));
  await a.page.locator("[data-wine-new]").click(); await sleep(400);
  const fld = await st(a.page, '[data-wine-field="name"]'), sv = await st(a.page, "[data-wine-save]");
  ok("LENS: форма — поля стеклом, «Сохранить» — плашка", !!fld && fld.bg === GLASS && isMain(sv), JSON.stringify([fld, sv]));
  await go(a.page, "reference", 1800);
  const rc = await st(a.page, '[data-ref-card="winelist"]'), art = await a.page.locator('[data-ref-card="winelist"] [data-ref-art="winelist"] svg').count();
  const h = await a.page.evaluate(() => [...document.querySelectorAll("[data-ref-card]")].map((c) => Math.round(c.getBoundingClientRect().height)));
  ok("LENS: «Справочник» — курсы карточками; у «Нашей винной карты» — свой витраж и та же высота, что у курсов", lensCard(rc) && art === 1 && new Set(h).size === 1, JSON.stringify([rc, art, h]));
  await shot(a.page, "reference");
  await a.ctx.close();
  // карточка «Дальше» под пройденной темой (владелец: «Ещё пару нашёл. Далее…»): у Анны «Психология первого дня» пройдена
  const n = await open({ who: ANNA, srv: srvOf(MENU) });
  await hideToasts(n.page);
  await nav(n.page, "home", 2400);
  await n.page.evaluate(() => { const b = [...document.querySelectorAll(".tbp-num")].find((x) => x.textContent.trim() === "0"); if (b) b.click(); }); await sleep(900);
  await n.page.evaluate(() => { const e = document.querySelector('[data-next-card="next"]'); if (e) e.scrollIntoView({ block: "center" }); }); await sleep(500);
  const nc = await st(n.page, '[data-next-card="next"]'), nd = await st(n.page, '[data-next-card="next"] > [data-lens="disc"]'), nb = await st(n.page, '[data-next-card="next"] [data-lens-btn="main"]');
  await shot(n.page, "next-card");
  ok("LENS: «Дальше» под пройденной темой — карточка, номер шага — круглая линза, «Перейти ›» — плашка с кольцом", lensCard(nc) && isDisc(nd) && nd.rad === "50%" && isMain(nb), JSON.stringify([nc, nd, nb]));
  await n.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf(MENU_W);
  const a = await open({ who: MARIA, srv, menu: MENU_W, light: true });
  await hideToasts(a.page);
  await toList(a.page); await sleep(1400);
  const low1 = await pxAll(a.page, ['[data-wine-row="w-pro"] span', '[data-wine-only="all"]', "[data-wine-edit]"]);
  const la = await lightAudit(a.page);
  await shot(a.page, "paper-list");
  ok("PAPER: карта — подписи читаются, свет карточек их не съедает", !low1.length && !la.out.length, JSON.stringify([low1, la]));
  await a.page.locator("[data-wine-edit]").click(); await sleep(1500);
  const low2 = await pxAll(a.page, ["[data-wine-new]", "[data-wine-import-open]", '[data-wine-ok="w-ros"]']);
  ok("PAPER: редактор — «＋ Новое вино», «Импорт», «Верно» читаются", !low2.length, JSON.stringify(low2));
  await a.page.locator("[data-wine-new]").click(); await sleep(400);
  const low3 = await pxAll(a.page, ["[data-wine-fill]", "[data-wine-save]", '[data-wine-color="white"]']);
  await shot(a.page, "paper-form");
  ok("PAPER: форма — «Заполнить по названию», «Сохранить», цвета читаются", !low3.length, JSON.stringify(low3));
  const [e1, e2] = noErr(a); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close();
  const n = await open({ who: ANNA, srv: srvOf(MENU), light: true });
  await hideToasts(n.page);
  await nav(n.page, "home", 2400);
  await n.page.evaluate(() => { const b = [...document.querySelectorAll(".tbp-num")].find((x) => x.textContent.trim() === "0"); if (b) b.click(); }); await sleep(900);
  const low4 = await pxAll(n.page, ['[data-next-card="next"] [data-lens-btn="main"]']);
  ok("PAPER: «Перейти ›» на карточке «Дальше» читается", !low4.length, JSON.stringify(low4));
  await n.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf(MENU_W);
  const a = await open({ who: MARIA, srv, menu: MENU_W, seedExtra: { sa_home_look: "now" } });
  await hideToasts(a.page);
  await toList(a.page); await sleep(1400);
  const row = await st(a.page, "[data-wine-row]");
  ok("NOW: вид «как сейчас» — карта без света линзы (обычные карточки)", !!row && !/radial-gradient/.test(row.img) && row.bc !== EDGE, JSON.stringify(row));
  await shot(a.page, "now-list");
  await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf(MENU_W);
  const a = await open({ who: MARIA, srv, menu: MENU_W, w: 320, h: 700 });
  await hideToasts(a.page);
  await toList(a.page); await sleep(1400);
  const f1 = await fits(a.page);
  await a.page.locator("[data-wine-edit]").click(); await sleep(1500);
  const f2 = await fits(a.page), r2 = await ringIn(a.page, '[data-lens-btn="main"]');
  await a.page.locator("[data-wine-new]").click(); await sleep(400);
  const f3 = await fits(a.page);
  await shot(a.page, "narrow-form");
  ok("NARROW: 320 px — карта, редактор и форма без сдвига вбок, кольца в экране", f1.sw <= f1.W && f2.sw <= f2.W && f3.sw <= f3.W && !r2.length, JSON.stringify([f1, f2, r2, f3]));
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
