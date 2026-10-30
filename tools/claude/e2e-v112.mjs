// e2e v112 (Доп. 425): «Радио в дорогу» в линзах. Владелец (30.10, снимок радио): «Давай ещё радио в линзы». В виде «Линза»
// (по умолчанию), оболочка .tb-radio. Сервер — tools/claude/demo-app/fake-server.js (как e2e-v110). Разделы:
//   RADIO  — «закрыть», значок радио, «назад / вперёд на фразу», скорость — линзы с кольцом; «Слушать» — золотая линза с
//            кольцом; пластинка — в кольце; вкладки выпусков — капсула с кольцом, выбранный — плашка; обложка и «Вся дорога» —
//            золотая кромка, фон прежний; «К вопросам» — плашка с кольцом; деления фраз, точки и переключатель — прежние;
//   QUIZ   — ответы — стекло; верный и неверный — прежние зелёный и красный;
//   GUEST  — «Живой гость» (та же оболочка урока) — без линзы;
//   PAPER  — «Для чтения»: тёмное золото; NOW — вид «как сейчас»: радио прежнее; NARROW — 320 px: без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v112.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v112";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v112";
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


const toRadio = async (page) => {
  await nav(page, "shift", 1600);
  await until(() => page.locator('.sa-card[aria-label="Радио в дорогу"]').count(), 8000);
  await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click();
  return until(() => page.locator(".tb-radio .rd-ctl, .tb-radio .rd-note").count(), 9000);
};
const PILL = "rgba(232, 201, 131, 0.62) 0px 0px 0px 1px inset";

await run("RADIO", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  ok("RADIO: радио открылось — оболочка .tb-radio, выпуски и кнопки", !!(await toRadio(a.page)) && (await a.page.locator(".tb-radio .rd-ctl button.play").count()) === 1);
  await sleep(600);
  const x = await st(a.page, ".tb-radio .tb-x"), av = await st(a.page, ".tb-radio .tb-av");
  ok("RADIO: «закрыть» и значок радио — линзы: стекло, ободок, кольцо, значок золотом", !!x && !!av && x.bg === GLASS && x.ring === RING && x.color === GOLD_L && av.bg === GLASS && av.ring === RING
    && x.sh.includes("rgba(214, 178, 102, 0.45) 0px 0px 0px 1px inset"), JSON.stringify([x, av]));
  const btns = await a.page.evaluate(() => [...document.querySelectorAll(".tb-radio .rd-ctl button:not(.play)")].map((b) => { const s = getComputedStyle(b), r = getComputedStyle(b, "::after");
    return s.backgroundColor + "|" + (r.content !== "none" ? r.borderTopColor : "") + "|" + s.color; }));
  ok("RADIO: «назад», «вперёд на фразу» и скорость — линзы с кольцом", btns.length === 3 && btns.every((t) => t === GLASS + "|" + RING + "|" + GOLD_L), btns.join(" · "));
  const p = await st(a.page, ".tb-radio .rd-ctl button.play");
  ok("RADIO: «Слушать» — золотая линза: стекло со светом, золотой ободок, кольцо, значок золотом", !!p && /radial-gradient/.test(p.img) && p.color === HI && p.ring === "rgba(214, 178, 102, 0.55)"
    && p.sh.includes("rgba(232, 201, 131, 0.7) 0px 0px 0px 1px inset"), JSON.stringify(p));
  const disc = await a.page.evaluate(() => { const s = document.querySelector(".tb-radio .rd-card.cur .rd-sheen"); if (!s) return null; const r = getComputedStyle(s, "::after"); return { c: r.content, b: r.borderTopColor, r: r.borderTopLeftRadius }; });
  ok("RADIO: пластинка — в тонком кольце", !!disc && disc.c !== "none" && disc.b === RING, JSON.stringify(disc));
  const seg = await st(a.page, ".tb-radio .rd-seg"), pill = await st(a.page, ".tb-radio .rd-pill");
  ok("RADIO: вкладки выпусков — капсула с ободком и кольцом, выбранный — плашка с золотым ободком", !!seg && seg.ring === RING && seg.sh.includes("rgba(214, 178, 102, 0.45) 0px 0px 0px 1px inset")
    && !!pill && pill.sh.includes(PILL), JSON.stringify([seg, pill]));
  const card = await st(a.page, ".tb-radio .rd-card.cur");
  ok("RADIO: обложка — золотая кромка и блик, фон прежний (свой свет сверху)", !!card && card.bc === EDGE && /linear-gradient/.test(card.img) && !/radial-gradient/.test(card.img)
    && card.sh.includes("rgba(255, 255, 255, 0.18) 0px 1.5px 0px 0px inset"), JSON.stringify(card));
  const sw = await st(a.page, ".tb-radio .rd-sw"), knob = await st(a.page, ".tb-radio .rd-sw .k");
  // фон «Вся дорога» — прежний --glass (0,085; Chrome округляет до 0,086); у переключателя ::after — сам бегунок, не кольцо
  ok("RADIO: «Вся дорога» — золотая кромка и блик; переключатель — прежний", !!sw && sw.bc === EDGE && /^rgba\(226, 186, 116, 0\.08[56]\)$/.test(sw.bg) && sw.sh.includes("rgba(255, 255, 255, 0.18) 0px 1.5px 0px 0px inset")
    && !!knob && knob.sh === "none" && knob.bg === "rgba(226, 186, 116, 0.15)", JSON.stringify([sw, knob]));
  const segs = await a.page.evaluate(() => { const i = document.querySelector(".tb-radio .rd-card.cur .rd-segs button i"), d = document.querySelector(".tb-radio .rd-dots i"); return [i ? getComputedStyle(i).boxShadow : "?", d ? getComputedStyle(d).boxShadow : "нет"]; });
  ok("RADIO: деления фраз и точки выпусков — прежние", segs[0] !== "?" && !/inset/.test(segs[0]) && !/inset/.test(segs[1]), segs.join(" · "));
  const m = await st(a.page, ".tb-radio .tb-main");
  ok("RADIO: «К вопросам» — стеклянная плашка с кольцом, надпись золотом", !!m && /radial-gradient/.test(m.img) && m.color === HI && m.ring === RING, JSON.stringify(m));
  ok("RADIO: «Слушать» поверх кольца соседей не закрыт (нажимается)", (await onTop(a.page, ".tb-radio .rd-ctl button.play")) === "да");
  await shot(a.page, "radio");
  const [e1, e2] = noErr(a); ok("RADIO: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("QUIZ", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await toRadio(a.page); await sleep(500);
  await a.page.locator(".tb-radio .tb-main").click(); await sleep(900);
  const q = await st(a.page, ".tb-radio .rd-q button");
  ok("QUIZ: ответы — стекло с ободком и бликом", !!q && q.bg === GLASS && q.sh.includes("rgba(214, 178, 102, 0.45) 0px 0px 0px 1px inset") && !q.ring, JSON.stringify(q));
  // отвечаем на первый вопрос неверно (если первый вариант верный — вторым): видны зелёный и красный, как раньше
  await a.page.evaluate(() => { const g = document.querySelector(".tb-radio .rd-q"); const bs = g ? g.querySelectorAll("button") : []; if (bs[0]) bs[0].click(); });
  await sleep(700);
  const st2 = await a.page.evaluate(() => { const g = document.querySelector(".tb-radio .rd-q"); const ok = g && g.querySelector("button.ok"), bad = g && g.querySelector("button.bad");
    return { ok: ok ? getComputedStyle(ok).backgroundColor : "", bad: bad ? getComputedStyle(bad).backgroundColor : "", okSh: ok ? getComputedStyle(ok).boxShadow : "" }; });
  ok("QUIZ: верный ответ — прежний зелёный, без стекла", st2.ok === "rgba(93, 187, 138, 0.14)" && st2.okSh === "none", JSON.stringify(st2));
  await shot(a.page, "quiz");
  const [e1, e2] = noErr(a); ok("QUIZ: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("GUEST", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "shift", 1600);
  await until(() => a.page.locator('.sa-card[aria-label="Живой гость"]').count(), 8000);
  await a.page.locator('.sa-card[aria-label="Живой гость"]').first().click();
  await until(() => a.page.locator(".tb .tb-x").count(), 9000); await sleep(600);
  const cls = await a.page.evaluate(() => (document.querySelector(".tb") || {}).className || "");
  const x = await st(a.page, ".tb .tb-x");
  ok("GUEST: «Живой гость» — та же оболочка без .tb-radio, «закрыть» без линзы", cls === "tb" && !!x && !x.ring && x.sh === "none", cls + " " + JSON.stringify(x));
  await shot(a.page, "guest");
  const [e1, e2] = noErr(a); ok("GUEST: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, light: true });
  await toRadio(a.page); await sleep(600);
  const p = await st(a.page, ".tb-radio .rd-ctl button.play"), x = await st(a.page, ".tb-radio .tb-x"), m = await st(a.page, ".tb-radio .tb-main");
  ok("PAPER: «Для чтения» — линзы тёмным золотом: «Слушать», «закрыть», «К вопросам»", !!p && p.img.includes("rgba(255, 255, 255, 0.95)") && p.color === "rgb(138, 101, 36)" && p.ring === "rgba(139, 106, 48, 0.45)"
    && !!x && x.bg === "rgba(139, 106, 48, 0.09)" && x.color === "rgb(122, 93, 42)" && !!m && m.img.includes("rgba(255, 255, 255, 0.85)") && m.ring === "rgba(139, 106, 48, 0.45)", JSON.stringify([p, x, m]));
  await shot(a.page, "paper");
  const [e1, e2] = noErr(a); ok("PAPER: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, seedExtra: { sa_home_look: "now" } });
  await toRadio(a.page); await sleep(600);
  const p = await st(a.page, ".tb-radio .rd-ctl button.play"), x = await st(a.page, ".tb-radio .tb-x"), m = await st(a.page, ".tb-radio .tb-main");
  ok("NOW: вид «как сейчас» — «Слушать» прежнее золото с тёмным значком, «закрыть» и «К вопросам» без колец", !(await a.page.evaluate(() => document.documentElement.classList.contains("sa-lens")))
    && !!p && /radial-gradient/.test(p.img) && p.color === "rgb(26, 16, 8)" && !p.ring && !!x && !x.ring && !!m && /linear-gradient/.test(m.img) && !m.ring, JSON.stringify([p, x, m]));
  const disc = await a.page.evaluate(() => { const s = document.querySelector(".tb-radio .rd-sheen"); return s ? getComputedStyle(s, "::after").content : "нет"; });
  ok("NOW: пластинка — без кольца", disc === "none", disc);
  await shot(a.page, "now");
  const [e1, e2] = noErr(a); ok("NOW: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, w: 320, h: 700 });
  await toRadio(a.page); await sleep(700);
  const f = await a.page.evaluate(() => { const W = document.documentElement.clientWidth; const bad = [...document.querySelectorAll(".tb-radio .rd-ctl button, .tb-radio .tb-main, .tb-radio .tb-x, .tb-radio .rd-seg")]
    .map((e) => { const r = e.getBoundingClientRect(); return { c: e.className, l: r.left - 3.5, r: r.right + 3.5 }; }).filter((x) => x.l < 0 || x.r > W);
    return { W, sw: document.documentElement.scrollWidth, bad }; });
  ok("NARROW: 320 px — кнопки и кольца линз в экране, без сдвига вбок", f.sw <= f.W && !f.bad.length, JSON.stringify(f));
  await shot(a.page, "narrow");
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
