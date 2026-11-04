// e2e v128 (Доп. 441): «Барная карта» удобнее, проще, красивее. Владелец (01.11) прислал запись своей карты (120 вин, «не
// проверено 118», двуязычные названия, «Австрия, Австрия», долго листать) и спросил, как сделать удобнее, проще и красивее;
// на семь предложений — «Делаем все». Сервер — fake-server.js, карта — 30 вин (20 не проверены) и крепкое e2e-v127. Разделы:
//   CHECK     — руководителю «N вин ждут проверки… сейчас M из K», «Проверить подряд»; «Верно для раздела» — два касания,
//               сохраняет раздел (кто и когда); в строках — метка AI вместо «не проверено»; у сотрудника этого нет;
//   NAMES     — «Русское / Original» в две строки (в списке и карточке), регион не повторяет страну;
//   PICK      — «Подобрать гостю»: бюджет ступенями по ценам своей карты (за бутылку, в «Бокалом» — за бокал, у крепкого — за
//               порцию), сладость, «Нашлось: N», «Сбросить»;
//   PIN       — шапка не уезжает: копия сверху (вкладки, разделы, поиск, «наверх»), раздел и вкладка из копии; у коктейлей так же;
//   COCKTAILS — колода и лаборатория — две кнопки рядом (по касанию сразу туда, «Знаю?»), бокал в цвете коктейля у каждой строки;
// Затем владелец: «Заходя в коктейли, нажимая на колонку, появляется тот же список. Делаешь лишние движения» — «Да, давай»:
//   CARD      — касание коктейля — его карточка здесь же (бокал, состав с граммовкой, как готовить, подача, история, крепкое из
//               нашей карты), «назад» — в то же место списка; «Учить в колоде», «Собрать руками», «Править» и «назад» оттуда —
//               снова эта карточка;
//   STEPS     — «‹ предыдущее», «следующее ›» в карточках вин, крепкого и коктейлей в порядке списка (раздел, поиск);
//               вернулся — строка последней в поле зрения;
//   CROSS     — крепкое ↔ коктейль внутри карты, «назад» — туда, откуда пришёл;
//   EDITBACK  — «Править» → «Сохранить» (и «назад», «Отмена») — снова карточка, «Сохранено…»; «В архив» — список;
//   SEARCH    — лупа сверху и поиск справочника находят вина и крепкое; касание — карточка в «Барной карте»;
//   LENS, PAPER, NARROW — вид.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v128.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5330, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v128";
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

await run("CHECK", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: MARIA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  const b = await txt(o.page.locator("[data-wine-check-banner]"));
  ok("CHECK: руководителю над картой — сколько ждёт проверки и что команда учит только проверенные",
    /^20 вин ждут проверки Команда учит только проверенные: сейчас 10 вин из 30\. Проверь подряд или раздел целиком: «Верно для раздела» у его названия\. Проверить подряд$/.test(b), b);
  ok("CHECK: в строке итога «не проверено» больше нет (оно в этой строке сверху)", (await txt(o.page.locator("[data-wine-sum]"))) === "30 вин · бокалом 8");
  const sec = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-sec-ok]")].map((e) => e.getAttribute("data-wine-sec-ok") + ":" + e.textContent.trim()).join("|"));
  ok("CHECK: у разделов с непроверенным — «Верно для раздела: N»", sec === "sparkling:Верно для раздела: 5|white:Верно для раздела: 5|rose:Верно для раздела: 5|red:Верно для раздела: 5", sec);
  const tags = await o.page.evaluate(() => ({ ai: document.querySelectorAll("[data-wine-row] [data-wine-ai-tag]").length,
    word: [...document.querySelectorAll("[data-wine-row]")].some((r) => /не проверено/.test(r.textContent)) }));
  ok("CHECK: в строках — тихая метка AI, без «не проверено»", tags.ai === 20 && !tags.word, JSON.stringify(tags));
  await shot(o.page, "check-banner");
  const n0 = srv.calls.filter((c) => c.fn === "menu_set").length;
  await o.page.locator('[data-wine-sec-ok="sparkling"]').click(); await sleep(300);
  const sure = await txt(o.page.locator('[data-wine-sec-ok="sparkling"]'));
  ok("CHECK: первое касание переспрашивает и ничего не сохраняет", sure === "Подтвердить 5? Коснись ещё раз" && srv.calls.filter((c) => c.fn === "menu_set").length === n0, sure);
  await o.page.locator('[data-wine-sec-ok="sparkling"]').click();
  await until(() => o.page.locator("[data-wine-check-msg]").count(), 6000);
  const was = BIG.filter((w) => w.color === "sparkling" && w.ai.length).map((w) => w.id), sp = bigWines(srv).filter((w) => was.includes(w.id));
  ok("CHECK: второе — проверены все пять непроверенных игристых (кто и когда), остальное как было",
    was.length === 5 && sp.length === 5 && sp.every((w) => !w.ai.length && w.checkedBy === "Мария Ким" && w.checkedAt > 0) && bigWines(srv).filter((w) => w.ai.length).length === 15
      && bigWines(srv).filter((w) => w.checkedBy).length === 5 && (srv.S.menu || []).length === MENU_BIG.length,
    JSON.stringify(sp.map((w) => [w.id, w.ai, w.checkedBy])));
  const msg = await txt(o.page.locator("[data-wine-check-msg]")), b2 = await txt(o.page.locator("[data-wine-check-banner]"));
  ok("CHECK: «Проверено: 5 вин. Команда уже может их учить.», в строке сверху — 15 и «сейчас 15 вин из 30»", msg === "Проверено: 5 вин. Команда уже может их учить." && /^15 вин ждут проверки/.test(b2) && /сейчас 15 вин из 30/.test(b2), msg + " / " + b2);
  ok("CHECK: у игристых кнопки больше нет", !(await o.page.locator('[data-wine-sec-ok="sparkling"]').count()));
  await o.page.locator("[data-wine-check-go]").click(); await sleep(1500);
  ok("CHECK: «Проверить подряд» — сразу «Проверка подряд» в редакторе", /^0\/15$/.test((await o.page.locator("[data-wine-review-screen]").getAttribute("data-wine-review-screen").catch(() => "")) || ""));
  const [e1, e2] = noErr(o); ok("CHECK: без ошибок", e1, e2);
  await o.ctx.close();
  // сотрудник: ни строки сверху, ни кнопок раздела; метка AI — есть
  const s2 = srvOf(MENU_BIG), a = await open({ who: ANNA, srv: s2, menu: MENU_BIG });
  await hideToasts(a.page);
  await openBar(a.page, "wine");
  ok("CHECK: у сотрудника нет строки проверки и «Верно для раздела»; метка AI — есть",
    !(await a.page.locator("[data-wine-check-banner], [data-wine-sec-ok]").count()) && (await a.page.locator("[data-wine-ai-tag]").count()) === 20);
  await a.ctx.close();
});

await run("NAMES", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: ANNA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  const r = await o.page.evaluate(() => { const row = document.querySelector('[data-wine-row="w-b1"]'); const spans = row.querySelectorAll("span");
    return { main: spans[1] ? spans[1].textContent : "", orig: (row.querySelector("[data-wine-orig]") || {}).textContent || "", text: row.innerText.replace(/\s+/g, " ") }; });
  ok("NAMES: «Русское / Original» — в две строки: русское крупно, оригинал ниже", r.main === "Вино 1" && r.orig === "Wine 1 Reserve" && !/ \/ /.test(r.text), JSON.stringify(r));
  const plain = await o.page.evaluate(() => !document.querySelector('[data-wine-row="w-b2"] [data-wine-orig]'));
  ok("NAMES: без оригинала — одна строка", plain);
  const line = await o.page.evaluate(() => [...document.querySelector('[data-wine-row="w-b1"]').querySelectorAll("div")].map((d) => d.textContent).filter((t) => /санджовезе/.test(t)).sort((x, y) => x.length - y.length)[0] || "");
  ok("NAMES: регион совпал со страной — один раз: «Австрия · санджовезе · игристое брют»", line === "Австрия · санджовезе · игристое брют", line);
  await shot(o.page, "names");
  await o.page.locator('[data-wine-row="w-b1"]').click(); await sleep(800);
  const head = await o.page.evaluate(() => { const c = document.querySelector('[data-wine-card="w-b1"]'); return { title: [...c.querySelectorAll("div")].map((d) => d.textContent).find((t) => t === "Вино 1") || "", orig: (c.querySelector("[data-wine-orig]") || {}).textContent || "" }; });
  ok("NAMES: в карточке — заголовок по-русски, оригинал строкой", head.title === "Вино 1" && head.orig === "Wine 1 Reserve", JSON.stringify(head));
  const [e1, e2] = noErr(o); ok("NAMES: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("PICK", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: ANNA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  // v136 (Доп. 449): «Подобрать гостю» стало «Фильтр» (так же называлась кнопка «Сомелье»)
  ok("PICK: рядом с поиском — «Фильтр», панели пока нет", (await txt(o.page.locator("[data-wine-pick-open]"))) === "Фильтр" && !(await o.page.locator("[data-wine-pick]").count()));
  await o.page.locator("[data-wine-pick-open]").click(); await sleep(300);
  const p = await o.page.evaluate(() => ({ budget: [...document.querySelectorAll("[data-wine-budget]")].map((e) => e.textContent.replace(/ /g, " ")).join("|"),
    sweet: [...document.querySelectorAll("[data-wine-sweet]")].map((e) => e.textContent).join("|"), n: (document.querySelector("[data-wine-pick-n]") || {}).textContent || "",
    label: [...document.querySelectorAll("[data-wine-pick] div")].map((d) => d.textContent).find((t) => /^Бюджет/.test(t)) || "" }));
  // цены 2 000…16 500 через 500: треть — до 7 000, две трети — до 12 000
  ok("PICK: «Подобрать гостю» — бюджет за бутылку тремя ступенями по ценам своей карты, сладость", p.label === "Бюджет за бутылку" && p.budget === "до 7 000 ₽|до 12 000 ₽|от 12 000 ₽"
    && p.sweet === "сухое|полусухое|полусладкое|сладкое" && p.n === "Выбери бюджет или сладость", JSON.stringify(p));
  await shot(o.page, "pick-open");
  await o.page.locator('[data-wine-budget="1"]').click(); await sleep(300);
  const ids1 = await rowIds(o.page), n1 = await txt(o.page.locator("[data-wine-pick-n]"));
  const want1 = BIG.filter((w) => w.priceBottle <= 7000).map((w) => w.id);
  ok("PICK: «до 7 000 ₽» — только вина до 7 000 за бутылку, «Нашлось: 11 вин»", ids1.slice().sort().join() === want1.slice().sort().join() && n1 === "Нашлось: 11 вин", JSON.stringify({ ids1, n1 }));
  await o.page.locator('[data-wine-sweet="semisweet"]').click(); await sleep(300);
  const ids2 = await rowIds(o.page), want2 = BIG.filter((w) => w.priceBottle <= 7000 && w.sweet === "полусладкое").map((w) => w.id);
  ok("PICK: и полусладкое — пересечение; на кнопке — «Фильтр · 2»", ids2.slice().sort().join() === want2.slice().sort().join() && (await txt(o.page.locator("[data-wine-pick-open]"))) === "Фильтр · 2", ids2.join());
  await shot(o.page, "pick-on");
  await o.page.locator("[data-wine-pick-reset]").click(); await sleep(300);
  ok("PICK: «Сбросить» — снова вся карта", (await rowIds(o.page)).length === 30);
  await o.page.locator('[data-wine-only="glass"]').click(); await sleep(300);
  const gl = await o.page.evaluate(() => [...document.querySelectorAll("[data-wine-pick] div")].map((d) => d.textContent).find((t) => /^Бюджет/.test(t)) || "");
  ok("PICK: в «Бокалом» — бюджет за бокал", gl === "Бюджет за бокал", gl);
  await o.ctx.close();
  // крепкое: бюджет за порцию, сладости нет
  const s2 = srvOf(MENU_BIG), a = await open({ who: ANNA, srv: s2, menu: MENU_BIG });
  await hideToasts(a.page);
  await openBar(a.page, "spirit");
  await a.page.locator("[data-wine-pick-open]").click(); await sleep(300);
  const sp = await a.page.evaluate(() => ({ label: [...document.querySelectorAll("[data-wine-pick] div")].map((d) => d.textContent).find((t) => /^Бюджет/.test(t)) || "",
    sweet: document.querySelectorAll("[data-wine-sweet]").length, budget: document.querySelectorAll("[data-wine-budget]").length }));
  ok("PICK: у крепкого — бюджет за порцию, без сладости", sp.label === "Бюджет за порцию" && sp.sweet === 0 && sp.budget === 3, JSON.stringify(sp));
  const [e1, e2] = noErr(a); ok("PICK: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PIN", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: MARIA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  ok("PIN: наверху копии шапки нет, пока разделы видны", !(await pinState(o.page)));
  await scrollBy(o.page, 1500); await sleep(500);
  const p = await pinState(o.page);
  ok("PIN: пролистал вниз — сверху вкладки, разделы, поиск и «наверх»", !!p && p.top === 0 && p.tabs === "cocktail,wine,spirit" && p.chips === "Все|Бокалом|Игристые|Белые|Розовые|Красные"
    && (await o.page.locator("[data-bar-pin-search]").count()) === 1 && (await o.page.locator("[data-bar-pin-up]").count()) === 1, JSON.stringify(p));
  ok("PIN: копия на всю ширину экрана, фон плотный", !!p && p.w === p.W && /rgba?\(23, 18, 9/.test(p.bg), JSON.stringify(p));
  await shot(o.page, "pin");
  await o.page.locator('[data-wine-pin-only="white"]').click(); await sleep(700);
  const w = await rowIds(o.page);
  ok("PIN: раздел из копии — только белые, и список с начала (копия ушла)", w.length === 8 && w.every((id) => BIG.find((x) => x.id === id).color === "white") && !(await pinState(o.page)), w.join());
  await o.page.locator('[data-wine-only="all"]').click(); await sleep(300);
  await scrollBy(o.page, 1500); await sleep(500);
  await o.page.locator("[data-bar-pin-search]").click(); await sleep(600);
  const f = await o.page.evaluate(() => { const a = document.activeElement; const r = a ? a.getBoundingClientRect() : null; return { tag: a ? a.tagName + ":" + a.getAttribute("type") : "", top: r ? Math.round(r.top) : -1 }; });
  ok("PIN: поиск из копии — курсор в поле карты, поле на экране", f.tag === "INPUT:search" && f.top >= 0 && f.top < 200, JSON.stringify(f));
  await scrollBy(o.page, 1500); await sleep(500);
  await o.page.locator("[data-bar-pin-up]").click(); await sleep(900);
  ok("PIN: «наверх» — к началу экрана", (await o.page.evaluate(() => document.getElementById("root").scrollTop)) < 5);
  await scrollBy(o.page, 1500); await sleep(500);
  await o.page.locator('[data-bar-pin-tab="spirit"]').click(); await sleep(900);
  const t = await tabsOf(o.page);
  ok("PIN: вкладка из копии — «Крепкое» с начала", t.kind === "spirit" && (await o.page.evaluate(() => document.getElementById("root").scrollTop)) < 5 && !(await pinState(o.page)), JSON.stringify(t));
  await openBar(o.page, "cocktail");
  await scrollBy(o.page, 2500); await sleep(500);
  const c = await pinState(o.page);
  ok("PIN: у коктейлей — то же: вкладки и основы", !!c && c.tabs === "cocktail,wine,spirit" && /^Все\|Джин\|Водка\|Ром/.test(c.chips), JSON.stringify(c));
  await o.page.locator('[data-bar-pin-ck="Ром"]').click(); await sleep(700);
  ok("PIN: основа из копии — только ром", (await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-ck-group]")].map((e) => e.getAttribute("data-bar-ck-group")).join())) === "Ром");
  const [e1, e2] = noErr(o); ok("PIN: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("COCKTAILS", async () => {
  const srv = srvOf(MENU_B);
  const SR = { sa_cocktail_sr: JSON.stringify({ negroni: { stage: 2, due: PNOW + 3 * DAY }, mojito: { stage: 1, due: PNOW + DAY }, "old-fashioned": { stage: 1, due: PNOW - DAY } }) };
  const o = await open({ who: MARIA, srv, menu: MENU_B, seedExtra: SR });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail");
  const l = await o.page.evaluate(() => { const q = (k) => document.querySelector(`[data-bar-learn="${k}"]`), t = (e) => ((e || {}).textContent || "").replace(/\s+/g, " ").trim();
    const d = q("deck"), b = q("lab"), rd = d && d.getBoundingClientRect(), rb = b && b.getBoundingClientRect();
    return { learn: [...document.querySelectorAll("[data-bar-learn]")].map((e) => e.getAttribute("data-bar-learn")).join(), deck: t(d), lab: t(b), row: !!(rd && rb && Math.abs(rd.top - rb.top) < 2 && rd.right < rb.left),
      art: document.querySelectorAll("[data-bar-ck] [data-bar-ck-art] svg").length, rows: document.querySelectorAll("[data-bar-ck]").length }; });
  ok("COCKTAILS: «Колода» и «Лаборатория» — две кнопки в одну строку, у колоды — выучено 2 из 57 («Знаю?»)", l.learn === "deck,lab" && l.row && /^Колода ?выучено 2 из 57$/.test(l.deck) && /^Лаборатория ?собрать руками$/.test(l.lab), JSON.stringify(l));
  ok("COCKTAILS: у каждого коктейля — бокал в его цвете", l.rows === 57 && l.art === 57, JSON.stringify(l));
  await shot(o.page, "cocktails-art");
  await o.page.locator('[data-bar-learn="deck"]').click(); await sleep(1500);
  ok("COCKTAILS: «Колода» — одним касанием колода бармена", (await o.page.locator(".sa-ck-front").count()) > 0);
  await back(o.page); await sleep(700);
  ok("COCKTAILS: назад — снова коктейли «Барной карты»", (await tabsOf(o.page)).ck);
  await o.page.locator('[data-bar-learn="lab"]').click(); await sleep(1600);
  ok("COCKTAILS: «Лаборатория» — одним касанием бар-лаборатория («Сборка руками»)", /Сборка руками/.test(await txt(o.page.locator("body"))));
  const [e1, e2] = noErr(o); ok("COCKTAILS: без ошибок", e1, e2);
  await o.ctx.close();
});

// ── v128, затем: проще, без лишних касаний ──
// v136 (Доп. 449): в карточке коктейля «Как готовить» свёрнуто — раскрыть касанием (без прокрутки страницы)
const openHow = (page) => page.evaluate(() => { const b = document.querySelector('[data-bar-ck-how-toggle="closed"]'); if (b) b.click(); return !!b; });
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

await run("CARD", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "cocktail");
  // «Негрони» — в середине экрана; запомнить прокрутку
  const y0 = await o.page.evaluate(() => { const e = document.querySelector('[data-bar-ck="negroni"]'), r = document.getElementById("root"); e.scrollIntoView({ block: "center" }); return r.scrollTop; }); await sleep(300);
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(600);
  await openHow(o.page);   // v136: «Как готовить» свёрнуто — раскрыть (без прокрутки)
  const c = await ckCard(o.page);
  ok("CARD: касание «Негрони» — карточка здесь же, сверху; списка под ней нет", !!c && c.id === "negroni" && c.top === 0 && !(await o.page.locator("[data-bar-cocktails]").count()), JSON.stringify(c && { id: c.id, top: c.top }));
  ok("CARD: бокал, состав с граммовкой", !!c && c.art && c.ing.join("|") === "Джин30 мл|Кампари30 мл|Красный вермут30 мл", JSON.stringify(c && c.ing));
  ok("CARD: как готовить — семь шагов, как в лаборатории; подача, история, гостю", !!c && c.how.length === 7 && /^▽ ?Рокс/.test(c.how[0]) && /Стир 20 секунд/.test(c.how[5]) && /Подача Три равные части/.test(c.text) && /История Флоренция, 1919/.test(c.text) && /Гостю: «/.test(c.text), JSON.stringify(c && [c.how, c.text.slice(0, 600)]));
  ok("CARD: из нашей карты — Beefeater и Campari", !!c && c.ours.join() === "sp-bee,sp-cam" && /Из нашей карты Beefeater Campari/.test(c.text), JSON.stringify(c && c.ours));
  ok("CARD: «Учить в колоде» и «Собрать руками»; классику не правят", !!c && c.learn && c.build && !c.edit, JSON.stringify(c && [c.learn, c.build, c.edit]));
  await shot(o.page, "card-negroni");
  await back(o.page); await sleep(500);
  const y1 = await o.page.evaluate(() => document.getElementById("root").scrollTop);
  ok("CARD: назад — список на том же месте", Math.abs(y1 - y0) <= 4 && (await inView(o.page, '[data-bar-ck="negroni"]')), JSON.stringify({ y0, y1 }));
  // «Учить в колоде» → колода на «Негрони»; назад — снова карточка
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(500);
  await o.page.locator("[data-bar-ck-learn]").click(); await sleep(1500);
  const f1 = await deckFront(o.page);
  ok("CARD: «Учить в колоде» — колода открыта на «Негрони»", /^Негрони/i.test(f1), f1.slice(0, 80));
  await back(o.page); await sleep(900);
  ok("CARD: из колоды назад — снова карточка «Негрони»", ((await ckCard(o.page)) || {}).id === "negroni");
  await o.page.locator("[data-bar-ck-build]").click(); await sleep(1600);
  const lab = await txt(o.page.locator("body"));
  ok("CARD: «Собрать руками» — бар-лаборатория на «Негрони»", /Негрони/i.test(lab) && !(await o.page.locator("[data-bar-ck-card]").count()), lab.slice(0, 120));
  await back(o.page); await sleep(900);
  ok("CARD: из лаборатории назад — снова карточка «Негрони»", ((await ckCard(o.page)) || {}).id === "negroni");
  await back(o.page); await sleep(500);
  // свой коктейль: «свой», шаги — из его спека, «Править» у руководителя → редактор; назад — снова карточка
  await o.page.locator('[data-bar-ck="ck-sea"]').click(); await sleep(500);
  await openHow(o.page);
  const h = await ckCard(o.page);
  ok("CARD: свой коктейль — «свой», состав, шаги его спека, «Править»", !!h && h.id === "ck-sea" && /свой/.test(h.text) && h.ing.length === 2 && h.how.join("|") === "Лёд в хайбол|Водка и морс" && /Как готовить · 2 шага ▾ Лёд/.test(h.text) && h.edit && h.build, JSON.stringify(h && { how: h.how, ing: h.ing, edit: h.edit }));
  await o.page.locator('[data-bar-ck-edit="card"]').click(); await sleep(1500);
  ok("CARD: «Править» — редактор своих коктейлей", /Свои коктейли|Морской бриз/.test(await txt(o.page.locator("body"))) && !(await o.page.locator("[data-bar-ck-card]").count()));
  for (let i = 0; i < 3 && !(await o.page.locator("[data-bar-ck-card]").count()); i++) { await back(o.page); await sleep(700); }
  ok("CARD: из редактора назад — снова карточка своего коктейля", ((await ckCard(o.page)) || {}).id === "ck-sea");
  const [e1, e2] = noErr(o); ok("CARD: без ошибок", e1, e2);
  await o.ctx.close();
  // сотрудник: без «Править»; без спирта в карте — без «Из нашей карты»
  const s2 = srvOf(MENU_B), o2 = await open({ who: ANNA, srv: s2, menu: MENU_B });
  await hideToasts(o2.page);
  await openBar(o2.page, "cocktail");
  await o2.page.locator('[data-bar-ck="ck-sea"]').click(); await sleep(500);
  const a = await ckCard(o2.page);
  ok("CARD: у сотрудника — без «Править»", !!a && !a.edit && a.learn);
  await o2.ctx.close();
});

await run("STEPS", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: ANNA, srv, menu: MENU_BIG });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-only="red"]').click(); await sleep(400);
  const R = await rowIds(o.page);
  await o.page.locator(`[data-wine-row="${R[0]}"]`).click(); await sleep(500);
  const s1 = await stepsAt(o.page);
  ok("STEPS: в разделе «Красные» — 1 из " + R.length + ", без «предыдущего», «следующее» — второе красное", s1.card === R[0] && s1.at === "1/" + R.length && !s1.prev && /^следующее › ?Вино/.test(s1.next), JSON.stringify(s1));
  await stepGo(o.page, "next"); await stepGo(o.page, "next");
  const s2 = await stepsAt(o.page);
  ok("STEPS: «следующее» дважды — третье вино раздела, сверху экрана", s2.card === R[2] && s2.at === "3/" + R.length && /^‹ предыдущее/.test(s2.prev) && (await o.page.evaluate(() => document.getElementById("root").scrollTop)) === 0, JSON.stringify(s2));
  await stepGo(o.page, "prev");
  ok("STEPS: «предыдущее» — назад на одно", (await stepsAt(o.page)).card === R[1]);
  for (let i = 0; i < R.length; i++) { if (!(await o.page.locator('[data-card-step="next"]').count())) break; await stepGo(o.page, "next"); }
  const s3 = await stepsAt(o.page);
  ok("STEPS: последнее в разделе — без «следующего»", s3.card === R[R.length - 1] && !s3.next && s3.at === R.length + "/" + R.length, JSON.stringify(s3));
  await shot(o.page, "steps-wine-last");
  await back(o.page); await sleep(600);
  ok("STEPS: назад — раздел «Красные», строка последней карточки в поле зрения", (await o.page.locator('[data-wine-only="red"][aria-pressed="true"]').count()) === 1 && (await inView(o.page, `[data-wine-row="${R[R.length - 1]}"]`)));
  // с поиском — по найденному
  await o.page.locator('[data-wine-only="all"]').click(); await sleep(300);
  await o.page.locator('[data-wine-list] input[type="search"]').fill("Wine"); await sleep(500);
  const F = await rowIds(o.page);
  await o.page.locator(`[data-wine-row="${F[0]}"]`).click(); await sleep(500);
  const s4 = await stepsAt(o.page);
  await stepGo(o.page, "next");
  ok("STEPS: с поиском — по найденному (10 из 30)", F.length === 10 && s4.at === "1/10" && (await stepsAt(o.page)).card === F[1], JSON.stringify({ n: F.length, s4 }));
  await back(o.page); await sleep(400);
  // крепкое
  await o.page.locator('[data-wine-list] input[type="search"]').fill(""); await sleep(300);
  await o.page.locator('[data-bar-tab="spirit"]').click(); await sleep(700);
  const S0 = await rowIds(o.page);
  await o.page.locator(`[data-wine-row="${S0[0]}"]`).click(); await sleep(500);
  const s5 = await stepsAt(o.page);
  await stepGo(o.page, "next");
  ok("STEPS: крепкое — тоже подряд", s5.at === "1/" + S0.length && (await stepsAt(o.page)).card === S0[1], JSON.stringify({ S0, s5 }));
  await back(o.page); await sleep(400);
  // коктейли: основа «Ром»
  await o.page.locator('[data-bar-tab="cocktail"]').click(); await sleep(700);
  await o.page.locator('[data-bar-ck-only="Ром"]').click(); await sleep(400);
  const C = await ckIds(o.page);
  await o.page.locator(`[data-bar-ck="${C[0]}"]`).click(); await sleep(500);
  const s6 = await stepsAt(o.page);
  await stepGo(o.page, "next");
  const s7 = await stepsAt(o.page);
  ok("STEPS: коктейли основы «Ром» — подряд, «2 из N»", s6.at === "1/" + C.length && s7.card === C[1] && s7.at === "2/" + C.length, JSON.stringify({ C, s6, s7 }));
  await shot(o.page, "steps-cocktail");
  await back(o.page); await sleep(400);
  ok("STEPS: назад — снова «Ром»", (await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-ck-group]")].map((e) => e.getAttribute("data-bar-ck-group")).join())) === "Ром");
  const [e1, e2] = noErr(o); ok("STEPS: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("CROSS", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "spirit");
  await o.page.locator('[data-wine-row="sp-cam"]').click(); await sleep(500);
  await o.page.locator('[data-spirit-cocktail="negroni"]').click(); await sleep(700);
  ok("CROSS: в карточке Campari — «Негрони»: его карточка здесь же, в «Барной карте»", ((await ckCard(o.page)) || {}).id === "negroni" && !(await o.page.locator(".sa-ck-front").count()));
  await o.page.locator('[data-bar-ck-spirit="sp-bee"]').click(); await sleep(700);
  ok("CROSS: в «Негрони» — Beefeater: карточка крепкого", (await o.page.locator('[data-wine-card="sp-bee"]').count()) === 1);
  await back(o.page); await sleep(500);
  ok("CROSS: назад — снова «Негрони»", ((await ckCard(o.page)) || {}).id === "negroni");
  await back(o.page); await sleep(500);
  ok("CROSS: назад — снова Campari", (await o.page.locator('[data-wine-card="sp-cam"]').count()) === 1);
  await back(o.page); await sleep(500);
  ok("CROSS: назад — список крепкого", (await o.page.locator('[data-drink-kind="spirit"][data-wine-list]').count()) === 1 && (await tabsOf(o.page)).on === "spirit");
  await o.page.locator('[data-bar-tab="cocktail"]').click(); await sleep(600);
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(500);
  await o.page.locator('[data-bar-ck-spirit="sp-cam"]').click(); await sleep(700);
  await back(o.page); await sleep(500);
  ok("CROSS: из коктейля в крепкое и назад — снова коктейль", ((await ckCard(o.page)) || {}).id === "negroni");
  await back(o.page); await sleep(500);
  ok("CROSS: назад — список коктейлей", (await o.page.locator("[data-bar-cocktails]").count()) === 1);
  const [e1, e2] = noErr(o); ok("CROSS: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("EDITBACK", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: MARIA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator('[data-wine-row="w-cha"]').click(); await sleep(500);
  await o.page.locator("[data-wine-edit]").click(); await sleep(1500);
  ok("EDITBACK: «Править» в карточке — форма этого вина", (await o.page.locator('[data-wine-form="w-cha"]').count()) === 1);
  await o.page.locator('[data-wine-field="short"]').fill("Свежее, с мелом: к устрицам и крабу."); await sleep(200);
  await o.page.locator("[data-wine-save]").click();
  await until(() => o.page.locator('[data-wine-card="w-cha"]').count(), 9000);
  const sv = await o.page.evaluate(() => ({ card: !!document.querySelector('[data-wine-card="w-cha"]'), note: (document.querySelector("[data-wine-saved]") || {}).textContent || "", text: ((document.querySelector('[data-wine-card="w-cha"]') || {}).innerText || "").replace(/\s+/g, " ") }));
  const rec = wines(srv).find((w) => w.id === "w-cha") || {};
  ok("EDITBACK: «Сохранить» — снова карточка «Шабли», «Сохранено…», новая фраза гостю; на сервере — она же", sv.card && sv.note === "Сохранено: в карте у всех" && /к устрицам и крабу/.test(sv.text) && rec.short === "Свежее, с мелом: к устрицам и крабу.", JSON.stringify({ sv: sv.note, short: rec.short }));
  await shot(o.page, "editback-saved");
  await o.page.locator("[data-wine-edit]").click(); await sleep(1300);
  await back(o.page); await sleep(900);
  ok("EDITBACK: из формы «назад» — снова карточка, без «Сохранено»", (await o.page.locator('[data-wine-card="w-cha"]').count()) === 1 && !(await o.page.locator("[data-wine-saved]").count()));
  await o.page.locator("[data-wine-edit]").click(); await sleep(1300);
  await clickText(o.page, "button", "Отмена"); await sleep(900);
  ok("EDITBACK: «Отмена» — снова карточка", (await o.page.locator('[data-wine-card="w-cha"]').count()) === 1);
  await back(o.page); await sleep(500);
  ok("EDITBACK: из карточки назад — список вин", (await o.page.locator('[data-drink-kind="wine"][data-wine-list]').count()) === 1);
  // «В архив» из формы карточки — список, «Убрали в архив», вина в нём нет
  await o.page.locator('[data-wine-row="w-chi"]').click(); await sleep(500);
  await o.page.locator("[data-wine-edit]").click(); await sleep(1300);
  await clickText(o.page, "button", "В архив");
  await until(() => o.page.locator("[data-wine-list]").count(), 9000); await sleep(600);
  const ar = await o.page.evaluate(() => ({ list: !!document.querySelector("[data-wine-list]"), note: (document.querySelector("[data-wine-saved]") || {}).textContent || "", row: !!document.querySelector('[data-wine-row="w-chi"]') }));
  ok("EDITBACK: «В архив» — список, «Убрали в архив», вина в нём нет", ar.list && ar.note === "Убрали в архив" && !ar.row && (wines(srv).find((w) => w.id === "w-chi") || {}).archived === true, JSON.stringify(ar));
  // редактор из списка — как раньше: после «Сохранить» — список редактора
  await o.page.locator("[data-wine-edit]").click(); await sleep(1300);
  await o.page.locator('[data-wine-erow="w-pin"] [role="button"]').first().click().catch(() => {}); await sleep(700);
  if (await o.page.locator('[data-wine-form="w-pin"]').count()) {
    await o.page.locator("[data-wine-save]").click(); await sleep(1500);
    ok("EDITBACK: редактор из списка — после «Сохранить» снова список редактора", !(await o.page.locator("[data-wine-card]").count()) && (await o.page.locator("[data-wine-editor]").count()) === 1);
  } else ok("EDITBACK: редактор из списка — строка вина открывает форму", false, "нет формы w-pin");
  const [e1, e2] = noErr(o); ok("EDITBACK: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SEARCH", async () => {
  const srv = srvOf(MENU_B);
  const o = await open({ who: ANNA, srv, menu: MENU_B });
  await hideToasts(o.page);
  await nav(o.page, "roleSelect", 900);
  await o.page.click("[data-top-search]"); await sleep(1200);
  ok("SEARCH: в поле — «Блюдо, аллерген, вино, коктейль…»", (await o.page.locator('input[placeholder="Блюдо, аллерген, вино, коктейль…"]').count()) === 1);
  await o.page.fill("input", "шабли"); await sleep(700);
  const r1 = await o.page.evaluate(() => [...document.querySelectorAll("[data-search-drink]")].map((e) => e.getAttribute("data-search-drink") + ":" + e.innerText.replace(/\s+/g, " ").trim()));
  ok("SEARCH: «шабли» — «Барная карта», «Вина · Белые», цена", r1.length === 1 && /^w-cha:Вина · Белые Шабли 2022 Франция, Бургундия/.test(r1[0]) && /950/.test(r1[0]) && /Барная карта/.test(await txt(o.page.locator("body"))), JSON.stringify(r1));
  await shot(o.page, "search-chablis");
  await o.page.locator('[data-search-drink="w-cha"]').click(); await sleep(1500);
  ok("SEARCH: касание — карточка «Шабли» в «Барной карте»", (await o.page.locator('[data-wine-card="w-cha"]').count()) === 1);
  await back(o.page); await sleep(500);
  ok("SEARCH: из карточки назад — вина «Барной карты»", (await o.page.locator('[data-drink-kind="wine"][data-wine-list]').count()) === 1);
  await back(o.page); await sleep(900);
  await o.page.fill("input", "hennessy"); await sleep(700);
  const r2 = await o.page.evaluate(() => [...document.querySelectorAll("[data-search-drink]")].map((e) => e.getAttribute("data-search-drink") + ":" + e.innerText.replace(/\s+/g, " ").trim()));
  ok("SEARCH: «hennessy» — «Крепкое · Коньяк и бренди»", r2.length === 1 && /^sp-hen:Крепкое · Коньяк и бренди Hennessy VS/.test(r2[0]), JSON.stringify(r2));
  await o.page.locator('[data-search-drink="sp-hen"]').click(); await sleep(1500);
  ok("SEARCH: касание — карточка Hennessy", (await o.page.locator('[data-wine-card="sp-hen"]').count()) === 1);
  await back(o.page); await back(o.page); await sleep(900);
  await o.page.fill("input", "негрони"); await sleep(700);
  await o.page.locator('[data-search-cocktail="negroni"]').click(); await sleep(1500);
  ok("SEARCH: коктейль — его карточка в «Барной карте» (рецепт сразу)", ((await ckCard(o.page)) || {}).id === "negroni");
  await back(o.page); await back(o.page); await sleep(900);
  await o.page.fill("input", "Старое Мерло"); await sleep(700);
  ok("SEARCH: архив не находится", !(await o.page.locator("[data-search-drink]").count()));
  // поиск справочника
  await go(o.page, "reference", 1500);
  await o.page.locator('[aria-label="Поиск по справочнику"]').first().click().catch(() => {}); await sleep(1200);
  await o.page.locator("input").first().fill("maker"); await sleep(700);
  const r3 = await o.page.evaluate(() => [...document.querySelectorAll("[data-search-drink]")].map((e) => e.getAttribute("data-search-drink")));
  ok("SEARCH: поиск справочника — тоже: «maker» — Maker's Mark", r3.join() === "sp-mak", JSON.stringify(r3));
  if (r3.length) { await o.page.locator('[data-search-drink="sp-mak"]').click(); await sleep(1500); ok("SEARCH: из справочника — карточка Maker's Mark", (await o.page.locator('[data-wine-card="sp-mak"]').count()) === 1); }
  const [e1, e2] = noErr(o); ok("SEARCH: без ошибок", e1, e2);
  await o.ctx.close();
});

const look128 = async (tag, light) => {
  const P = pal(light);
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: MARIA, srv, menu: MENU_BIG, light });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  const bn = await st(o.page, "[data-wine-check-banner]");
  ok(`${tag}: строка проверки — карточка линзы`, !!bn && /radial-gradient/.test(bn.img), JSON.stringify(bn).slice(0, 200));
  await o.page.locator("[data-wine-pick-open]").click(); await sleep(300);
  const pk = await st(o.page, "[data-wine-pick]");
  ok(`${tag}: «Подобрать гостю» — карточка линзы`, !!pk && /radial-gradient/.test(pk.img) && pk.bc === P.EDGE, JSON.stringify(pk).slice(0, 200));
  if (light) {
    const low = await pxAll(o.page, ['[data-wine-row="w-b1"] [data-wine-ai-tag]', '[data-wine-row="w-b1"] [data-wine-orig]', '[data-wine-sec-ok="white"]', "[data-wine-pick-n]", '[data-wine-budget="1"]']);
    ok(`${tag}: метка AI, оригинал названия, кнопки и подписи читаются (контраст по пикселям)`, !low.length, JSON.stringify(low));
  }
  const la = await lightAudit(o.page);
  ok(`${tag}: свет карточек не съедает подписи`, la.n > 10 && !la.out.length, JSON.stringify(la).slice(0, 300));
  await shot(o.page, tag.toLowerCase() + "-wines");
  await scrollBy(o.page, 1500); await sleep(500);
  const pn = await pinState(o.page);
  ok(`${tag}: копия шапки — плотный фон своей темы`, !!pn && (light ? /rgba?\(242, 233, 212/ : /rgba?\(23, 18, 9/).test(pn.bg), JSON.stringify(pn));
  if (light) { const low2 = await pxAll(o.page, ['[data-bar-pin-tab="spirit"]', '[data-wine-pin-only="red"]']); ok(`${tag}: в копии шапки читается`, !low2.length, JSON.stringify(low2)); }
  await shot(o.page, tag.toLowerCase() + "-pin");
  // карточка коктейля: кнопки колоды и лаборатории — карточки линзы; состав — карточка, «Учить в колоде» — плашка, соседние — стекло
  await openBar(o.page, "cocktail");
  const lr = await st(o.page, '[data-bar-learn="lab"]');
  ok(`${tag}: «Колода» и «Лаборатория» — карточки линзы`, !!lr && /radial-gradient/.test(lr.img), JSON.stringify(lr).slice(0, 200));
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(600);
  const ing = await st(o.page, "[data-bar-ck-ing]"), lb = await st(o.page, "[data-bar-ck-learn]"), bd = await st(o.page, "[data-bar-ck-build]"), nx = await st(o.page, '[data-card-step="next"]');
  ok(`${tag}: карточка коктейля — состав карточкой линзы, «Учить в колоде» — плашка, «Собрать руками» и соседние — стекло`,
    !!ing && /radial-gradient/.test(ing.img) && ing.bc === P.EDGE && !!lb && /radial-gradient/.test(lb.img) && !!bd && bd.bg === P.GLASS && !!nx && nx.bg === P.GLASS, JSON.stringify([ing, lb, bd, nx]).slice(0, 400));
  if (light) {
    await openHow(o.page);
    const low3 = await pxAll(o.page, ['[data-bar-ck-ing] > div span', '[data-bar-ck-how] li', '[data-bar-ck-how-toggle] span', '[data-card-step="next"] span', "[data-bar-ck-learn]", "[data-bar-ck-build]", "[data-bar-ck-story]"]);
    ok(`${tag}: в карточке коктейля всё читается (контраст по пикселям)`, !low3.length, JSON.stringify(low3));
  }
  const la2 = await lightAudit(o.page);
  ok(`${tag}: свет карточек не съедает подписи карточки коктейля`, !la2.out.length, JSON.stringify(la2).slice(0, 300));
  await shot(o.page, tag.toLowerCase() + "-ck-card");
  const [e1, e2] = noErr(o); ok(`${tag}: без ошибок`, e1, e2);
  await o.ctx.close();
};
await run("LENS", () => look128("LENS", false));
await run("PAPER", () => look128("PAPER", true));

await run("NARROW", async () => {
  const srv = srvOf(MENU_BIG);
  const o = await open({ who: MARIA, srv, menu: MENU_BIG, w: 320, h: 700 });
  await hideToasts(o.page);
  await openBar(o.page, "wine");
  await o.page.locator("[data-wine-pick-open]").click(); await sleep(300);
  const f1 = await fits(o.page);
  await shot(o.page, "narrow-wines");
  await scrollBy(o.page, 1500); await sleep(500);
  const p = await pinState(o.page), f2 = await fits(o.page);
  const tb = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-pin-tab]")].every((b) => b.scrollWidth <= b.clientWidth + 1));
  await shot(o.page, "narrow-pin");
  ok("NARROW: 320 px — строка проверки, «Подобрать» и копия шапки без сдвига вбок, вкладки не обрезаны", f1.sw <= f1.W && f2.sw <= f2.W && !!p && p.w <= p.W && tb, JSON.stringify({ f1, f2, p, tb }));
  // коктейли: две кнопки — без сдвига вбок, названия целиком; карточка и «‹ предыдущее / следующее ›» — тоже
  await openBar(o.page, "cocktail");
  const f3 = await fits(o.page);
  const lt = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-learn] div div:first-child")].map((e) => ({ t: e.textContent, cut: e.scrollWidth > e.clientWidth + 1, top: Math.round(e.closest("[data-bar-learn]").getBoundingClientRect().top) })));
  await shot(o.page, "narrow-cocktails");
  await o.page.locator('[data-bar-ck="negroni"]').click(); await sleep(600);
  const f4 = await fits(o.page);
  await o.page.evaluate(() => { const r = document.getElementById("root"); r.scrollTop = r.scrollHeight; }); await sleep(400);
  await shot(o.page, "narrow-ck-card");
  // текст кнопки целиком (ширина текста — по Range: кольцо линзы ::after у плашки выходит за кнопку и сдвигает scrollWidth)
  const bb = await o.page.evaluate(() => [...document.querySelectorAll("[data-bar-ck-learn], [data-bar-ck-build]")].map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const s = getComputedStyle(e);
    return { cut: rg.getBoundingClientRect().width > e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) + 0.5, h: Math.round(e.getBoundingClientRect().height) }; }));
  // v129: кнопки — в общей строке «Учить» по две в ряд; «Лаборатория» в половину 320 px не влезает — друг под другом, целиком
  ok("NARROW: 320 px — «Колода» и «Лаборатория» целиком, карточка коктейля без сдвига вбок, её кнопки — в одну строчку текста",
    f3.sw <= f3.W && f4.sw <= f4.W && lt.length === 2 && lt.every((x) => !x.cut) && bb.length === 2 && bb.every((x) => !x.cut && x.h < 60), JSON.stringify({ f3, f4, lt, bb }));
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
