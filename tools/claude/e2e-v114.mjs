// e2e v114 (Доп. 427): «Наставник» — список бесед и «Очистить переписку?» под шапкой и в полноэкранном Telegram.
// Владелец (30.10, запись экрана): «Я нашёл у ассистента баг: когда нажимаешь на выбор чата» — в полноэкранном Telegram
// экран Наставника отступает сверху на высоту кнопок Telegram (--sa-st), а панели отсчитывали 62 px от самого верха и
// уезжали под «Назад» и «…». Сервер — tools/claude/demo-app/fake-server.js (как e2e-v110–v113). Разделы:
//   TG    — отступ сверху 108 px (как iPhone в полноэкранном Telegram): список бесед и «Очистить переписку?» — сразу под шапкой,
//           целиком на виду, ничем не закрыты; тап мимо — закрывает;
//   PLAIN — обычное окно (без отступа): панель на прежнем месте, под шапкой;
//   NOW   — вид «как сейчас»: так же под шапкой (место панели от вида не зависит).
//   TABS  — вкладки «Смена», «Команда», «Я» (запись владельца того же вечера: «некрасивая анимация появления кнопок… как будто
//           подгружается»): экран без общего въезда, карточки въезжают все разом (без очереди), строки внутри карточек — без своего
//           въезда (по анимациям: задержка 0, начало — в пределах кадра), после въезда всё видно целиком; другие экраны въезжают,
//           как раньше.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v114.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5310, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v114";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v114";
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

async function open({ who = MARIA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, mobile = true, path = "/", seedExtra = {}, fold = false, motion = false } = {}) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: motion ? "no-preference" : "reduce" });
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



const TG_TOP = 108;
// отступ полноэкранного Telegram — как его ставит lib/tg-screen.js (переменная на <html>)
const fullscreen = (page, px) => page.evaluate((px) => { document.documentElement.style.setProperty("--sa-st", px + "px");
  if (!document.getElementById("e2e-sast")) document.head.insertAdjacentHTML("beforeend", `<style id="e2e-sast">html{--sa-st:${px}px !important}</style>`); }, px);
// шапка Наставника (ряд с «Список чатов») и панель: где они и что видно в точках панели
const geo = (page, panelSel, need = "") => page.evaluate(([panelSel, need]) => {
  const btn = document.querySelector('[aria-label="Список чатов"]'); if (!btn) return { err: "нет кнопки" };
  let head = btn; while (head && head.parentElement && !/sa-dlg/.test(head.parentElement.className)) head = head.parentElement;
  const h = head.getBoundingClientRect();
  const p = [...document.querySelectorAll(panelSel)].find((e) => e.offsetParent !== null && getComputedStyle(e).position === "absolute" && (!need || e.textContent.includes(need)));
  if (!p) return { err: "нет панели", head: Math.round(h.bottom) };
  const r = p.getBoundingClientRect();
  const pts = [[r.left + 14, r.top + 10], [r.left + r.width / 2, r.top + 10], [r.right - 14, r.top + 10]];
  const own = pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e === p || p.contains(e)); });
  return { head: Math.round(h.bottom), top: Math.round(r.top), bottom: Math.round(r.bottom), own, text: p.innerText.replace(/\s+/g, " ").slice(0, 60) };
}, [panelSel, need]);
const LIST = "div.sa-pagein.sa-dlgscroll", ASK = "div.sa-pagein";
const openMentor = async (page) => { await nav(page, "assistant", 2000); return until(() => page.locator('[aria-label="Список чатов"]').count(), 9000); };

await run("TG", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await fullscreen(a.page, TG_TOP);
  ok("TG: Наставник открылся", !!(await openMentor(a.page)));
  await sleep(400);
  const headTop = await a.page.evaluate(() => Math.round(document.querySelector('[aria-label="Список чатов"]').getBoundingClientRect().top));
  ok("TG: шапка Наставника — под кнопками Telegram (отступ 108 px)", headTop >= 108, "верх кнопки " + headTop);
  await a.page.locator('[aria-label="Список чатов"]').click(); await sleep(600);
  const g = await geo(a.page, LIST);
  ok("TG: список бесед — сразу под шапкой, а не под кнопками Telegram", !g.err && g.top >= g.head - 2 && g.top <= g.head + 16, JSON.stringify(g));
  ok("TG: список бесед целиком на виду (ничем не закрыт)", !!g.own && /пусто|·/.test(g.text || ""), JSON.stringify(g));
  await shot(a.page, "tg-list");
  await a.page.mouse.click(196, 700); await sleep(500);
  ok("TG: тап мимо — список закрылся", (await a.page.locator(LIST).count()) === 0);
  // переписка с одной репликой — появляется «Очистить переписку»
  await a.page.locator(".sa-ai-bar textarea").fill("Как предложить десерт?");
  await a.page.locator(".sa-ai-bar textarea").press("Enter").catch(() => {});
  await sleep(300);
  const send = a.page.locator('.sa-ai-bar button:not([data-talk-open]):not([aria-label="Сказать голосом"])').last();
  if (await send.count()) await send.click().catch(() => {});
  await until(() => a.page.locator('[aria-label="Очистить переписку"]').count(), 9000);
  await a.page.locator('[aria-label="Очистить переписку"]').click(); await sleep(600);
  const c = await geo(a.page, ASK, "Очистить переписку?");
  ok("TG: «Очистить переписку?» — сразу под шапкой, целиком на виду", !c.err && c.top >= c.head - 2 && c.top <= c.head + 16 && c.own && /Очистить переписку/.test(c.text || ""), JSON.stringify(c));
  await shot(a.page, "tg-clear");
  const [e1, e2] = noErr(a); ok("TG: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("PLAIN", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv });
  await openMentor(a.page); await sleep(400);
  await a.page.locator('[aria-label="Список чатов"]').click(); await sleep(600);
  const g = await geo(a.page, LIST);
  const rootTop = await a.page.evaluate(() => Math.round(document.querySelector(".sa-dlg").getBoundingClientRect().top));
  ok("PLAIN: обычное окно — список на прежнем месте (62 px от верха экрана Наставника), под шапкой", !g.err && g.top - rootTop === 62 && g.top >= g.head - 2 && g.own, JSON.stringify({ ...g, rootTop }));
  await shot(a.page, "plain-list");
  const [e1, e2] = noErr(a); ok("PLAIN: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NOW", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, seedExtra: { sa_home_look: "now" } });
  await fullscreen(a.page, TG_TOP);
  await openMentor(a.page); await sleep(400);
  await a.page.locator('[aria-label="Список чатов"]').click(); await sleep(600);
  const g = await geo(a.page, LIST);
  ok("NOW: вид «как сейчас» в полноэкранном Telegram — список так же под шапкой", !g.err && g.top >= g.head - 2 && g.top <= g.head + 16 && g.own, JSON.stringify(g));
  const [e1, e2] = noErr(a); ok("NOW: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("TABS", async () => {
  const srv = srvOf();
  const a = await open({ who: MARIA, srv, motion: true });
  await nav(a.page, "me", 1500);
  // по анимациям карточек (Web Animations): задержка, длительность, когда началась; не зависит от загрузки машины
  const probe = (page) => page.evaluate(() => {
    const scr = document.querySelector(".sa-hubscreen"); if (!scr) return { err: "нет хаба" };
    const tab = scr.closest(".sa-tabpad"), wrapEl = tab ? tab.parentElement : null;
    const cards = [...scr.querySelectorAll(".sa-pagein")].filter((e) => e.offsetParent !== null);
    const rows = cards.flatMap((c) => [...c.children].filter((x) => x.tagName === "DIV"));
    const an = cards.map((c) => { const x = c.getAnimations().find((q) => q.animationName === "saPageIn"); const t = x ? x.effect.getTiming() : null;
      return x ? { d: t.delay, dur: t.duration, ct: x.currentTime == null ? null : Math.round(x.currentTime), ps: x.playState } : null; });
    return { wrapAnim: wrapEl ? getComputedStyle(wrapEl).animationName : "?", n: cards.length, an, rowAnims: [...new Set(rows.map((r) => getComputedStyle(r).animationName))] };
  });
  const settled = (page) => page.evaluate(async () => {
    const scr = document.querySelector(".sa-hubscreen"); if (!scr) return 0;
    const cards = [...scr.querySelectorAll(".sa-pagein")].filter((e) => e.offsetParent !== null);
    await Promise.all(cards.flatMap((c) => c.getAnimations()).map((x) => x.finished.catch(() => null)));
    await new Promise((r) => setTimeout(r, 400));   // карточка с данными с сервера могла въехать позже — дождёмся и её
    const late = [...scr.querySelectorAll(".sa-pagein")].filter((e) => e.offsetParent !== null);
    await Promise.all(late.flatMap((c) => c.getAnimations()).map((x) => x.finished.catch(() => null)));
    const op = late.map((c) => [+getComputedStyle(c).opacity, (c.getAttribute("aria-label") || c.textContent || "").trim().slice(0, 30)]);
    return { min: Math.min(...op.map((x) => x[0])), low: op.filter((x) => x[0] < 0.99) };
  });
  for (const k of ["shift", "teamHub", "me"]) {
    await a.page.evaluate((x) => window.__saNav(x), k); await sleep(80);
    const p0 = await probe(a.page);
    const live = (p0.an || []).filter(Boolean);
    const cts = live.map((x) => x.ct).filter((x) => x != null);
    ok("TABS: «" + k + "» — экран без общего въезда, карточки — один въезд без задержки, строки в карточках — без своего въезда",
      !p0.err && p0.n >= 3 && p0.wrapAnim === "none" && live.length >= 3 && live.every((x) => x.d === 0 && x.dur <= 320) && p0.rowAnims.every((x) => x === "none"), JSON.stringify(p0));
    // все в одной точке въезда: у запущенных — одинаковое время от начала (± кадр); ещё не запущенные стартуют вместе (задержки 0)
    ok("TABS: «" + k + "» — карточки въезжают все разом (в одной точке въезда, ± кадр)", cts.length < 2 || Math.max(...cts) - Math.min(...cts) <= 34, JSON.stringify(live));
    const op = await settled(a.page);
    ok("TABS: «" + k + "» — когда въезд закончился, все карточки видны целиком", op && op.min >= 0.99, JSON.stringify(op));
  }
  await nav(a.page, "glossary", 120);
  const g = await a.page.evaluate(() => { const t = document.querySelector(".sa-tabpad"); const w = t ? t.parentElement : null; return w ? getComputedStyle(w).animationName : "?"; });
  ok("TABS: другие экраны («Глоссарий») въезжают, как раньше", g === "saPageIn", g);
  const [e1, e2] = noErr(a); ok("TABS: без ошибок", e1, e2);
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
