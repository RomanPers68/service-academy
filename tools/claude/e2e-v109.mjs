// e2e v109 (Доп. 422): «Что дало обучение». Владелец (29.10) выбрал «Итог месяца владельцу»: чему команда училась и что за
// это время изменилось в зале, по сравнению с прошлым месяцем. Сервер — tools/claude/demo-app/fake-server.js (как этап 43). Разделы:
//   HUB     — «Команда» → «Управление»: «Что дало обучение» сразу под «Аналитикой» (руководителю), у сотрудника пункта нет;
//   SCREEN  — этот месяц «пока» (1–10, с теми же днями прошлого): уроки, тесты, кто занимался из команды, «спасибо» гостей
//             и коллег, ошибки в тестах, новички до самостоятельной смены, темы, кто вырос, кто не занимался — всё как у сервера;
//   MONTH   — прошлый месяц целиком (со всем позапрошлым): кто пришёл позже, в команде того месяца не считается;
//   OLD     — журнал позапрошлого месяца уже не на телефонах: «уже не сравнить…», без «было»; месяц без занятий — «пока никто»;
//   NUDGE   — «Напомнить» тому, кто не занимался: бот ему пишет; без Telegram — «нет Telegram»;
//   SEND    — «Прислать этот итог в Telegram»: сообщение бота, как 1-го числа, с кнопкой «Открыть итог»; второй раз — через минуту;
//   LINK    — кнопка бота ведёт по ссылке ?go=gain_<месяц>: этот месяц сразу открыт; назад — главная вкладка;
//   ROLE    — сотруднику по ссылке — «Этот экран только у руководителей»;
//   NOLINK  — Telegram не подключён: «Подключить» открывает «Напоминания в Telegram»;
//   MISSING — этапа 43 нет: владельцу — как обновить сервер и «Файл», руководителю — «когда владелец обновит сервер»;
//   PAPER   — «Для чтения»; NARROW — 320 px без сдвига вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v109.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5299, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v109";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v109";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const G = await import(SRC + "/lib/gain.js");
const { plural } = await import(SRC + "/lib/morning.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

// ── дни: как в телефоне (Камчатка); сегодня — всегда 10-е число этого месяца (часы страницы сдвинуты), чтобы месяц «пока» был
// с десятью днями, а журнал позапрошлого месяца ещё был на телефонах (75 дней) ──
const TZ = "Asia/Kamchatka";
const REAL = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const TODAY = REAL.slice(0, 8) + "10";
const SHIFT_MS = (10 - Number(REAL.slice(8, 10))) * 86400e3;
const M = TODAY.slice(0, 7), MP = G.monthAdd(M, -1), MPP = G.monthAdd(M, -2);
const dIn = (m, n) => m + "-" + String(n).padStart(2, "0");
const off = (iso) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(+TODAY.slice(0, 4), +TODAY.slice(5, 7) - 1, 10)) / 864e5);

const R0 = "Два моря, Океан";
const P = (id, name, surname, position, x = {}) => ({ id, name, surname, restaurant: R0, position, is_admin: false, ...x });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter");
const PETR = P("e-petr", "Пётр", "Орлов", "waiter"), VERA = P("e-vera", "Вера", "Соколова", "waiter"), DARYA = P("e-darya", "Дарья", "Лебедева", "waiter");
const ILYA = P("e-ilya", "Илья", "Белов", "bartender"), KSENIA = P("e-ksenia", "Ксения", "Миронова", "waiter"), TIMUR = P("e-timur", "Тимур", "Ахметов", "bartender");
const ROMAN = P("u-roman", "Роман", "", "owner", { is_admin: true });
const PEOPLE = [MARIA, OLGA, ANNA, PETR, VERA, DARYA, ILYA, KSENIA, TIMUR, ROMAN];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 }, { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 },
  { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } }, split: {},
  rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: { waiter: { pattern: "even" } }, dayShift: "Д", staff: SSTAFF };
function planOf() {
  const out = {};
  for (let i = -45; i <= 30; i++) { const c2 = ((i % 4) + 4) % 4; (out[1] = out[1] || {})[i] = c2 < 2 ? "Д" : ""; for (const sid of [3, 4, 5, 6]) if ((i + sid) % 3) (out[sid] = out[sid] || {})[i] = "Д"; }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0]));
// журнал занятий по дням (этот месяц — до 9-го, прошлый — 1–10 для сравнения и дальше): Анна и Пётр занимаются чаще, чем месяцем
// раньше, Мария — так же, Вера — реже; Дарья и Илья в этом месяце ни разу; Ксения пришла 2-го (новичок, сама — с 7-го),
// Тимур — новичок прошлого месяца (с 1-го, сам — с 9-го)
const A = (m, days, r) => Object.fromEntries(days.map((n) => [off(dIn(m, n)), { ...r }]));
const ACTIVITY = {
  "e-anna": { ...A(M, [2, 4, 6, 8, 9], { st: 3, l: 2, q: 1 }), ...A(MP, [3, 15, 22], { st: 1, l: 1 }) },
  "e-petr": { ...A(M, [3, 5, 7], { st: 3, l: 2, q: 1, p: 1 }), ...A(MP, [2, 6], { st: 1, l: 1, q: 1 }) },
  "u-maria": { ...A(M, [1, 5, 9], { st: 2, l: 1, q: 1 }), ...A(MP, [1, 4, 8], { st: 2, l: 1, q: 1 }) },
  "e-vera": { ...A(M, [4], { st: 1, l: 1 }), ...A(MP, [2, 5, 9], { st: 2, l: 1, q: 1 }) },
  "e-olga": A(M, [6], { st: 1, l: 1 }), "e-ilya": A(MP, [3], { st: 1, l: 1 }), "e-ksenia": A(M, [3], { st: 2, l: 2 }),
  "e-timur": { ...A(M, [2], { st: 1, l: 1 }), ...A(MP, [2, 3, 5], { st: 2, l: 2 }) },
};
// ответы в тестах: этот месяц — 16 ответов, 3 неверных; те же дни прошлого — 12 и 5
const QUIZ = [{ emp: "e-anna", lesson: "s4-q", at: off(dIn(M, 4)), n: 4, w: 1 }, { emp: "e-anna", lesson: "s1-q", at: off(dIn(M, 8)), n: 4, w: 1 },
  { emp: "e-petr", lesson: "s4-q", at: off(dIn(M, 5)), n: 4, w: 1 }, { emp: "u-maria", lesson: "m3-q", at: off(dIn(M, 9)), n: 4, w: 0 },
  { emp: "e-petr", lesson: "s4-q", at: off(dIn(MP, 6)), n: 4, w: 2 }, { emp: "u-maria", lesson: "m3-q", at: off(dIn(MP, 4)), n: 4, w: 1 }, { emp: "e-vera", lesson: "s1-q", at: off(dIn(MP, 5)), n: 4, w: 2 }];
const TITLES = { "s4-q": "Работа с жалобами", "s1-q": "Мышление сервиса", "m3-q": "Управление командой" };
// «спасибо» гостей (скрытое не считается) и коллег
const THANKS = [...[3, 6, 9].map((n) => ({ emp: "e-anna", at: off(dIn(M, n)), text: "Спасибо за вечер" })), { emp: "e-petr", at: off(dIn(M, 7)) }, { emp: "e-vera", at: off(dIn(M, 8)), hidden: true },
  { emp: "e-anna", at: off(dIn(MP, 2)) }, { emp: "e-vera", at: off(dIn(MP, 5)) }, { emp: "e-petr", at: off(dIn(MP, 20)) }];
const PEER = [{ from: "u-maria", to: "e-anna", text: "выручила с банкетом", at: off(dIn(M, 6)), time: "21:50", plus: [] }, { from: "e-olga", to: "e-ilya", text: "помог у бара", at: off(dIn(M, 9)), time: "20:10", plus: [] },
  { from: "e-vera", to: "e-petr", text: "подменил в субботу", at: off(dIn(MP, 4)), time: "22:15", plus: [] }];
const NEWBIES = [{ emp: "e-ksenia", started: off(dIn(M, 2)), solo: off(dIn(M, 7)), buddy: "e-anna", buddyBy: "u-maria" },
  { emp: "e-timur", started: off(dIn(MP, 1)), solo: off(dIn(MP, 9)), buddy: "e-ilya", buddyBy: "u-maria" }];
function srvOf() {
  const pings = [];
  const s = makeServer({ today: TODAY, clock: () => Date.now() + SHIFT_MS, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU,
    tgLinked: ["u-maria", "e-anna", "e-darya"], cheers: false, activity: ACTIVITY, quiz: QUIZ, thanks: THANKS, peerThanks: PEER, newbies: NEWBIES,
    ping: (to, text, acts, chat, msg, o) => pings.push({ to, text, o }) });
  s.calls = []; s.pings = pings;
  return s;
}

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = MARIA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, path = "/", seedExtra = {} } = {}) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce" });
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
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: MENU }), sa_boot_missing: String(Date.now() + SHIFT_MS), ...seedExtra };
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
const shotFull = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png", fullPage: true });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !e.closest(".ch-veil") && !e.closest("[data-chat]"); }).map((e) => (typeof e.className === "string" && e.className ? e.className.slice(0, 40) : e.tagName)); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const calls = (srv, fn) => srv.calls.filter((c) => c.fn === fn);
const lastCall = (srv, fn) => [...srv.calls].reverse().find((c) => c.fn === fn) || null;
const hubItem = (page, label) => page.locator(`.sa-card[aria-label="${label}"]`).first();
const ready = (page) => until(async () => (await page.locator('[data-gain="ready"]').count()) > 0 && !/обновляю/.test(await txt(page.locator("[data-gain-period]"))), 9000);
const toGain = async (page) => {
  await nav(page, "teamHub", 1400);
  await until(async () => (await hubItem(page, "Что дало обучение").count()) > 0, 6000);
  await hubItem(page, "Что дало обучение").click();
  return ready(page);
};
const chips = (page) => page.evaluate(() => [...document.querySelectorAll("[data-gain-month]")].map((e) => e.getAttribute("data-gain-month") + ":" + e.getAttribute("aria-pressed") + ":" + e.innerText.trim()));
// v110 (Доп. 423): у строк — разница цифрой («+8 · было 16»; в зале — под значением), у людей — кружок с инициалами
const dl = (x) => (G.deltaText ? G.deltaText(x) : "");
const ini = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const statLine = (x) => x.text + " " + (x.key === "lessons" ? plural(x.now, "урок", "урока", "уроков") : x.key === "tests" ? plural(x.now, "тест", "теста", "тестов") : "занимались") + (x.was != null ? (dl(x) ? " " + dl(x) + " ·" : "") + " было " + x.wasText : "");
const hallLine = (x) => x.label + (x.was != null ? " было " + x.wasText : "") + " " + x.text + (dl(x) ? " " + dl(x) : "");
// экран — то же, что ответ сервера за этот месяц (числа и слова — lib/gain.js)
async function sameAsServer(page, g, tag) {
  const m = G.gainModel(g), bad = [];
  const per = await txt(page.locator("[data-gain-period]"));
  if (per !== [m.rest, G.compareLabel(m)].join(" · ")) bad.push("период: " + per);
  for (const x of G.learnRows(m)) { const t = await txt(page.locator(`[data-gain-stat="${x.key}"]`)); if (t !== statLine(x)) bad.push(x.key + ": «" + t + "» ≠ «" + statLine(x) + "»"); }
  const hall = G.hallRows(m), keys = await page.evaluate(() => [...document.querySelectorAll('[data-gain-sec="hall"] [data-gain-row]')].map((e) => e.getAttribute("data-gain-row")));
  if (keys.join(",") !== hall.map((x) => x.key).join(",")) bad.push("зал: " + keys.join(","));
  for (const x of hall) {
    const r = page.locator(`[data-gain-sec="hall"] [data-gain-row="${x.key}"]`), t = await txt(r), good = await r.getAttribute("data-gain-good");
    if (t !== hallLine(x) || good !== (x.good == null ? "" : x.good ? "1" : "0")) bad.push(x.key + ": «" + t + "» " + good + " ≠ «" + hallLine(x) + "»");
  }
  const tops = m.topics.filter((t) => TITLES[t.id]), shown = await page.evaluate(() => [...document.querySelectorAll("[data-gain-topic]")].map((e) => e.getAttribute("data-gain-topic")));
  if (shown.join(",") !== tops.map((t) => t.id).join(",")) bad.push("темы: " + shown.join(","));
  for (const t of tops) { const s = await txt(page.locator(`[data-gain-topic="${t.id}"]`)); if (s !== TITLES[t.id] + " " + G.topicLine(t)) bad.push(t.id + ": " + s); }
  if (tops.length && (await txt(page.locator('[data-gain-h="topics"]'))) !== "Темы месяца " + m.topicsN + " " + plural(m.topicsN, "тема", "темы", "тем")) bad.push("заголовок тем: " + (await txt(page.locator('[data-gain-h="topics"]'))));
  const grew = await page.evaluate(() => [...document.querySelectorAll("[data-gain-grew]")].map((e) => e.getAttribute("data-gain-grew")));
  if (grew.join(",") !== m.grew.map((x) => x.id).join(",")) bad.push("выросли: " + grew.join(","));
  for (const x of m.grew) { const s = await txt(page.locator(`[data-gain-grew="${x.id}"]`)); if (s !== ini(x.n) + " " + x.n + " " + G.grewWhy(x)) bad.push(x.id + ": " + s); }
  const idle = await page.evaluate(() => [...document.querySelectorAll("[data-gain-idle]")].map((e) => e.getAttribute("data-gain-idle")));
  if (idle.join(",") !== m.idle.map((x) => x.id).join(",")) bad.push("не занимались: " + idle.join(","));
  if (m.idle.length && (await txt(page.locator('[data-gain-h="idle"]'))) !== "Не занимались в " + G.monthPrep(m.month) + " " + (m.idle.length + m.idleMore)) bad.push("заголовок: " + (await txt(page.locator('[data-gain-h="idle"]'))));
  for (const x of m.idle) { const s = await txt(page.locator(`[data-gain-idle="${x.id}"]`)); if (!s.startsWith(ini(x.n) + " " + x.n + " ")) bad.push(x.id + ": " + s); }
  ok(tag, !bad.length, bad.slice(0, 4).join(" | "));
}

await run("HUB", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "teamHub", 1400);
  await until(async () => (await hubItem(m.page, "Что дало обучение").count()) > 0, 6000);
  const order = await m.page.evaluate(() => [...document.querySelectorAll(".sa-card[aria-label]")].map((e) => e.getAttribute("aria-label")));
  ok("HUB: руководителю в «Команда» → «Управление» — «Что дало обучение» сразу под «Аналитикой»: «Чему учились и что изменилось в зале»",
    order.indexOf("Что дало обучение") === order.indexOf("Аналитика") + 1 && order.indexOf("Аналитика") >= 0
    && /Чему учились и что изменилось в зале/.test(await txt(hubItem(m.page, "Что дало обучение"))), order.slice(0, 6).join(","));
  await hubItem(m.page, "Что дало обучение").scrollIntoViewIfNeeded().catch(() => {});
  await shot(m.page, "hub");
  await hubItem(m.page, "Что дало обучение").click();
  ok("HUB: пункт открывает экран, итог — за этот месяц (сервер выбирает сам)", (await ready(m.page)) && /Что дало обучение/.test(await txt(m.page.locator('[data-gain="ready"]')))
    && lastCall(srv, "gain_month") && lastCall(srv, "gain_month").body.p_month === null, JSON.stringify(lastCall(srv, "gain_month")));
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "teamHub", 1800);
  ok("HUB: у сотрудника (Анна) пункта нет", (await until(async () => (await hubItem(a.page, "Рейтинг").count()) > 0, 6000)) && !(await hubItem(a.page, "Что дало обучение").count()));
  const [e1, e2] = noErr(m, a); ok("HUB: без ошибок", e1, e2);
  await m.ctx.close(); await a.ctx.close();
});

await run("SCREEN", async () => {
  const srv = srvOf();
  const g = srv.rpc("gain_month", { p_token: tok(MARIA) });
  // данные: числа, ради которых всё и затевалось (сервер — как этап 43, сверен на Postgres)
  ok("SCREEN: на сервере — 1–10 этого месяца с 1–10 прошлого: уроков 24 (было 16), тестов 11 (8), занимались 7 из 9 (6); ошибок 19% (42%); «спасибо» гостей 4 (2), коллег 2 (1); новичок за 5 дней (8)",
    g.ok && g.partial && g.from === dIn(M, 1) && g.to === TODAY && g.pto === dIn(MP, 10) && g.team === 9 && g.learn.lessons === 24 && g.learn.tests === 11 && g.learn.people === 7
    && g.plearn.lessons === 16 && g.plearn.tests === 8 && g.plearn.people === 6 && G.wrongPct(g.quiz) === 19 && G.wrongPct(g.pquiz) === 42 && g.thanks.n === 4 && g.thanks.prev === 2
    && g.peer.n === 2 && g.peer.prev === 1 && g.newbies.n === 1 && g.newbies.days === 5 && g.newbies.pn === 1 && g.newbies.pdays === 8
    && g.grew.map((x) => x.id).join(",") === "e-anna,e-petr" && g.idle.map((x) => x.id).join(",") === "e-darya,e-ilya", JSON.stringify(g).slice(0, 400));
  const m = await open({ who: MARIA, srv });
  await toGain(m.page);
  const ch = await chips(m.page);
  ok("SCREEN: месяцы — «<этот> пока» (выбран) и прошлый", ch.join(" | ") === [M + ":true:" + G.monthNom(M) + " пока", MP + ":false:" + G.monthNom(MP)].join(" | "), ch.join(" | "));
  ok("SCREEN: под месяцами — «Два моря, Океан · 1–10 <месяца>, сравниваем с 1–10 <прошлого>»",
    (await txt(m.page.locator("[data-gain-period]"))) === R0 + " · 1–10 " + G.monthGen(M) + ", сравниваем с 1–10 " + G.monthGen(MP), await txt(m.page.locator("[data-gain-period]")));
  await sameAsServer(m.page, g, "SCREEN: «Чему учились», «Что изменилось в зале», темы, кто вырос и кто не занимался — как у сервера");
  ok("SCREEN: в зале стало лучше — стрелки «лучше» у всех четырёх строк", (await m.page.locator('[data-gain-sec="hall"] [data-gain-good="1"]').count()) === 4);
  ok("SCREEN: «Больше всех выросли»: Анна С. «10 уроков и 5 тестов, было 1 и 0», Пётр О.", /^АС Анна С\. 10 уроков и 5 тестов, было 1 и 0$/.test(await txt(m.page.locator('[data-gain-grew="e-anna"]')))
    && /^ПО Пётр О\. /.test(await txt(m.page.locator('[data-gain-grew="e-petr"]'))), await txt(m.page.locator('[data-gain-sec="grew"]')));
  ok("SCREEN: «Темы месяца»: «Работа с жалобами» — тест проходили 2 человека", /^Работа с жалобами тест проходили 2 человека$/.test(await txt(m.page.locator('[data-gain-topic="s4-q"]'))),
    await txt(m.page.locator('[data-gain-topic="s4-q"]')));
  ok("SCREEN: «1-го числа в Telegram»: «бот присылает 1-го числа в 10:00», «Прислать этот итог в Telegram»",
    /Итог прошлого месяца бот присылает 1-го числа в 10:00/.test(await txt(m.page.locator('[data-gain-sec="tg"]'))) && (await m.page.locator("[data-gain-send]").count()) === 1);
  ok("SCREEN: названия уроков — из уроков приложения (и своих уроков заведения: cms_list_lessons)", calls(srv, "cms_list_lessons").length > 0);
  await shot(m.page, "screen");
  await shotFull(m.page, "screen-full");
  const [e1, e2] = noErr(m); ok("SCREEN: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("MONTH", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toGain(m.page);
  await m.page.locator(`[data-gain-month="${MP}"]`).click();
  await until(async () => (await m.page.locator(`[data-gain-month="${MP}"][aria-pressed="true"]`).count()) > 0, 6000); await ready(m.page);
  const g = srv.rpc("gain_month", { p_token: tok(MARIA), p_month: MP });
  ok("MONTH: прошлый месяц — с сервера за этот месяц (p_month), выбран", lastCall(srv, "gain_month").body.p_month === MP && (await m.page.locator(`[data-gain-month="${M}"][aria-pressed="false"]`).count()) === 1);
  ok("MONTH: прошлый месяц целиком — «сравниваем с <позапрошлым>»", (await txt(m.page.locator("[data-gain-period]"))) === R0 + " · сравниваем с " + G.monthIns(MPP), await txt(m.page.locator("[data-gain-period]")));
  ok("MONTH: Ксения пришла в этом месяце — в команде прошлого её нет: «занимались N из 8»", g.team === 8 && !g.idle.some((x) => x.id === "e-ksenia")
    && new RegExp("^\\d+ из 8 занимались").test(await txt(m.page.locator('[data-gain-stat="people"]'))), await txt(m.page.locator('[data-gain-stat="people"]')));
  await sameAsServer(m.page, g, "MONTH: всё — как у сервера за прошлый месяц");
  await shot(m.page, "month");
  await m.page.locator(`[data-gain-month="${M}"]`).click();
  await until(async () => (await m.page.locator(`[data-gain-month="${M}"][aria-pressed="true"]`).count()) > 0, 6000); await ready(m.page);
  ok("MONTH: назад к этому месяцу — снова «пока», 1–10", lastCall(srv, "gain_month").body.p_month === M && /1–10/.test(await txt(m.page.locator("[data-gain-period]"))));
  const [e1, e2] = noErr(m); ok("MONTH: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("OLD", async () => {
  const srv = srvOf();
  // журнал позапрошлого месяца уже не на телефонах (как сервер, когда до его начала больше 75 дней)
  const old = (fn, b) => (fn === "gain_month" ? { ...srv.rpc(fn, b), plearn: null, grew: [] } : undefined);
  const m = await open({ who: MARIA, srv, rpcs: old });
  await toGain(m.page);
  ok("OLD: «Занятия в <прошлом> уже не сравнить: телефоны хранят журнал занятий 75 дней.»",
    (await txt(m.page.locator("[data-gain-nolearn]"))) === "Занятия в " + G.monthPrep(MP) + " уже не сравнить: телефоны хранят журнал занятий 75 дней.", await txt(m.page.locator("[data-gain-nolearn]")));
  ok("OLD: у уроков, тестов и «занимались» нет «было»; «Больше всех выросли» нет", !/было/.test(await txt(m.page.locator('[data-gain-sec="learn"] [data-gain-stat]').first()))
    && !(await m.page.locator('[data-gain-sec="learn"] [data-gain-stat] >> text=/было/').count()) && !(await m.page.locator('[data-gain-sec="grew"]').count()));
  await shot(m.page, "old");
  await m.ctx.close();
  const srv2 = srvOf();
  const empty = (fn, b) => (fn === "gain_month" ? { ...srv2.rpc(fn, b), learn: { people: 0, lessons: 0, tests: 0, practice: 0, guest: 0, days: 0 }, quiz: { n: 0, wrong: 0 }, pquiz: { n: 0, wrong: 0 },
    thanks: { n: 0, prev: 0 }, peer: { n: 0, prev: 0 }, newbies: { n: 0, days: 0, pn: 0, pdays: 0 }, topics: [], topicsN: 0, grew: [] } : undefined);
  const q = await open({ who: MARIA, srv: srv2, rpcs: empty });
  await toGain(q.page);
  ok("OLD: в месяце пока никто не занимался — «В этом месяце пока никто не занимался.», в зале — «Пока сравнивать нечего»",
    (await txt(q.page.locator("[data-gain-quiet]"))) === "В этом месяце пока никто не занимался." && /^Пока сравнивать нечего/.test(await txt(q.page.locator('[data-gain-sec="hall"]')))
    && !(await q.page.locator('[data-gain-sec="topics"]').count()), await txt(q.page.locator('[data-gain-sec="hall"]')));
  await shot(q.page, "quiet");
  const [e1, e2] = noErr(m, q); ok("OLD: без ошибок", e1, e2);
  await q.ctx.close();
});

await run("NUDGE", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toGain(m.page);
  await m.page.locator('[data-gain-nudge="e-darya"]').click();
  ok("NUDGE: «Напомнить» Дарье — «Напомнили»; бот написал Дарье про разминку", await until(async () => /Напомнили/.test(await txt(m.page.locator('[data-gain-nudge="e-darya"]'))), 5000)
    && lastCall(srv, "morning_nudge").body.p_emp === "e-darya" && srv.pings.some((x) => x.to === "e-darya" && /Мария К\. напоминает про разминку/.test(x.text)), JSON.stringify(srv.pings.slice(-2)));
  await m.page.locator('[data-gain-nudge="e-ilya"]').click();
  ok("NUDGE: у Ильи нет Telegram — вместо кнопки «нет Telegram»", await until(async () => /^ИБ Илья Б\. нет Telegram$/.test(await txt(m.page.locator('[data-gain-idle="e-ilya"]'))), 5000),
    await txt(m.page.locator('[data-gain-idle="e-ilya"]')));
  await m.page.locator('[data-gain-sec="idle"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot(m.page, "nudge");
  const [e1, e2] = noErr(m); ok("NUDGE: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("SEND", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await toGain(m.page);
  await m.page.locator("[data-gain-send]").click();
  const g = srv.rpc("gain_month", { p_token: tok(MARIA) });
  ok("SEND: «Прислать этот итог в Telegram» — «Отправил в Telegram: открой чат с ботом.»", await until(async () => (await txt(m.page.locator("[data-gain-note]"))) === "Отправил в Telegram: открой чат с ботом.", 5000)
    && lastCall(srv, "gain_send_now").body.p_month === M, await txt(m.page.locator("[data-gain-note]")));
  const pg = srv.pings.find((x) => x.to === "u-maria" && x.o && x.o.kind === "gain");
  ok("SEND: бот прислал Марии итог, как 1-го числа: «Что дало обучение · <месяц>», «Чему учились», «Что изменилось в зале»; кнопка «Открыть итог»",
    !!pg && pg.text === G.gainText(g) && pg.text.startsWith("<b>Что дало обучение · " + G.monthLow(M) + "</b>\n" + R0 + " · 1–10 " + G.monthGen(M) + ", сравниваем с 1–10 " + G.monthGen(MP))
    && /\n«Спасибо» от гостей: 4, было 2\n/.test(pg.text) && JSON.stringify(pg.o.kb) === JSON.stringify([[{ text: "Открыть итог", go: "gain_" + M }]]), pg ? pg.text.slice(0, 200) : "нет");
  await m.page.locator('[data-gain-sec="tg"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot(m.page, "send");
  await m.page.locator("[data-gain-send]").click();
  ok("SEND: второй раз сразу — «Только что отправлял. Через минуту можно ещё раз.»", await until(async () => /Только что отправлял\. Через минуту можно ещё раз\./.test(await txt(m.page.locator("[data-gain-note]"))), 5000)
    && srv.pings.filter((x) => x.o && x.o.kind === "gain").length === 1);
  const [e1, e2] = noErr(m); ok("SEND: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("LINK", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, path: "/?go=gain_" + MP });
  ok("LINK: кнопка бота «Открыть итог» (?go=gain_<прошлый>) — сразу экран за прошлый месяц", (await ready(m.page)) && (await m.page.locator(`[data-gain-month="${MP}"][aria-pressed="true"]`).count()) === 1
    && calls(srv, "gain_month").every((c) => c.body.p_month === MP), JSON.stringify(calls(srv, "gain_month").map((c) => c.body.p_month)));
  await m.page.locator('[data-gain="ready"] [data-lens="back"]').click();
  // как у других ссылок бота: назад — туда, где приложение открылось (главная вкладка)
  ok("LINK: назад — главная вкладка приложения", await until(async () => !(await m.page.locator("[data-gain]").count()) && (await m.page.locator(".sa-card[aria-label]").count()) > 0, 6000));
  const m2 = await open({ who: MARIA, srv, path: "/?go=gain" });
  ok("LINK: ?go=gain — этот месяц", (await ready(m2.page)) && (await m2.page.locator(`[data-gain-month="${M}"][aria-pressed="true"]`).count()) === 1);
  const [e1, e2] = noErr(m, m2); ok("LINK: без ошибок", e1, e2);
  await m.ctx.close(); await m2.ctx.close();
});

await run("ROLE", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, path: "/?go=gain" });
  ok("ROLE: сотруднику по ссылке — «Этот экран только у руководителей.»", await until(async () => (await a.page.locator('[data-gain="error"]').count()) > 0 && /Этот экран только у руководителей\./.test(await txt(a.page.locator('[data-gain="error"]'))), 9000));
  const [e1, e2] = noErr(a); ok("ROLE: без ошибок", e1, e2);
  await a.ctx.close();
});

await run("NOLINK", async () => {
  const srv = srvOf();
  const r = await open({ who: ROMAN, srv });
  await toGain(r.page);
  ok("NOLINK: у владельца Telegram не подключён — «Включи «Напоминания в Telegram», и 1-го числа итог прошлого месяца придёт туда.», «Подключить»",
    /Telegram не подключён Включи «Напоминания в Telegram», и 1-го числа итог прошлого месяца придёт туда\./.test(await txt(r.page.locator('[data-gain-sec="tg"]')))
    && (await r.page.locator("[data-gain-link]").count()) === 1 && !(await r.page.locator("[data-gain-send]").count()), await txt(r.page.locator('[data-gain-sec="tg"]')));
  ok("NOLINK: владельца в команде нет — «занимались 7 из 9»", /^7 из 9 занимались/.test(await txt(r.page.locator('[data-gain-stat="people"]'))), await txt(r.page.locator('[data-gain-stat="people"]')));
  await r.page.locator("[data-gain-link]").click();
  ok("NOLINK: «Подключить» — «Напоминания в Telegram»", await until(() => r.page.locator('[role="dialog"][aria-label="Напоминания в Telegram"]').count(), 5000));
  await shot(r.page, "nolink");
  const [e1, e2] = noErr(r); ok("NOLINK: без ошибок", e1, e2);
  await r.ctx.close();
});

await run("MISSING", async () => {
  const srv = srvOf();
  const miss = (fn) => (["gain_month", "gain_send_now"].includes(fn) ? { code: "PGRST202", message: "no fn" } : undefined);
  const r = await open({ who: ROMAN, srv, rpcs: miss });
  await toGain(r.page).catch(() => {});
  await until(() => r.page.locator("[data-gain-missing]").count(), 6000);
  ok("MISSING: этапа 43 нет — владельцу «Нужен этап 43 на сервере», как обновить и «Файл»", /^Нужен этап 43 на сервере Supabase → SQL Editor → New query → вставь supabase-stage43-gain\.sql → Run\./.test(await txt(r.page.locator("[data-gain-missing]")))
    && (await r.page.locator("[data-gain-missing] button", { hasText: "Файл" }).count()) === 1, await txt(r.page.locator("[data-gain-missing]")));
  await shot(r.page, "missing");
  const m = await open({ who: MARIA, srv, rpcs: miss });
  await toGain(m.page).catch(() => {});
  await until(() => m.page.locator("[data-gain-missing]").count(), 6000);
  ok("MISSING: руководителю — «Итог появится, когда владелец обновит сервер (этап 43).», без «Файл»", /Итог появится, когда владелец обновит сервер \(этап 43\)\./.test(await txt(m.page.locator("[data-gain-missing]")))
    && !(await m.page.locator("[data-gain-missing] button").count()));
  const [e1, e2] = noErr(r, m); ok("MISSING: без ошибок", e1, e2);
  await r.ctx.close(); await m.ctx.close();
});

await run("PAPER", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, light: true });
  await toGain(m.page);
  const bg = await m.page.evaluate(() => getComputedStyle(document.querySelector('[data-gain-sec="learn"]')).backgroundColor);
  // v110: вместо стрелки — разница цифрой; «лучше» — тёмно-зелёная
  const ar = await m.page.evaluate(() => { const p = document.querySelector('[data-gain-sec="hall"] [data-gain-good="1"] [data-gain-delta]'); return p ? getComputedStyle(p).color : ""; });
  ok("PAPER: «Для чтения» — светлые карточки, разница «лучше» — тёмно-зелёная", /rgba\(250, 242, 222/.test(bg) && ar === "rgb(44, 107, 72)", bg + " " + ar);
  await shot(m.page, "paper");
  await m.ctx.close();
});

await run("NARROW", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, w: 320, h: 700 });
  await toGain(m.page);
  const f1 = await fits(m.page);
  ok("NARROW: 320 px — экран без сдвига вбок", f1.sw <= f1.W && f1.n === 0, JSON.stringify(f1));
  await shot(m.page, "narrow");
  await m.page.locator('[data-gain-sec="idle"]').scrollIntoViewIfNeeded().catch(() => {});
  const f2 = await fits(m.page);
  ok("NARROW: и внизу (кто не занимался, Telegram) — тоже", f2.sw <= f2.W && f2.n === 0, JSON.stringify(f2));
  await shot(m.page, "narrow-idle");
  await m.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
