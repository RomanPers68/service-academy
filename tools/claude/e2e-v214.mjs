// e2e v214 (Доп. 540): закрытые дни заведения и тип дня на дату. Сервер графика в памяти, руководитель Мария
// (старший — правит график), официантка Анна. Месяц — следующий за сегодняшним: в нём ничего не заморожено.
// Разделы:
//   HOURS  — «Заполнить» без выходных: понедельники с людьми; «Часы работы» → «Выходные дни заведения» → пн: строка
//            «закрыто весь день», «В закрытые дни остались смены» и «Снять»; настройки ушли на сервер с closedDows;
//   GEN    — «Заполнить» ещё раз: в понедельники никого, столбцы заштрихованы, в полоске месяца пенёк без недобора;
//   DAY    — лист дня: «Закрыто» на среду (подпись, «Снять смены этого дня», «как в правилах»), «Пиковый» на
//            вторник, банкет в понедельник; «Сохранить» — пометки дней в месяце;
//   STAFF  — календарь Анны: «закр.» в понедельники и в закрытую среду, в банкетный понедельник — нет;
//   NARROW — 320 px: пилюли типа дня и выходных дней без прокрутки вбок, обе темы.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v214.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5414, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v214";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const TZ = "Asia/Kamchatka";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const [TY, TM] = TODAY.split("-").map(Number);
const NY = TM === 12 ? TY + 1 : TY, NM = TM === 12 ? 1 : TM + 1;          // следующий месяц, 1–12
const NK = NY + "-" + String(NM).padStart(2, "0");
const NDAYS = new Date(Date.UTC(NY, NM, 0)).getUTCDate();
const dowN = (d) => (new Date(Date.UTC(NY, NM - 1, d)).getUTCDay() + 6) % 7;   // 0 — понедельник
const MONS = [...Array(NDAYS)].map((_, i) => i + 1).filter((d) => dowN(d) === 0);
const firstOf = (w) => [...Array(NDAYS)].map((_, i) => i + 1).find((d) => dowN(d) === w && d > 7) || [...Array(NDAYS)].map((_, i) => i + 1).find((d) => dowN(d) === w);
const WED = firstOf(2), TUE = firstOf(1), MON2 = MONS[1];   // среда и вторник второй недели, второй понедельник

const R0 = "Два моря, Океан";
const MARIA = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const ANNA = { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const clone = (x) => JSON.parse(JSON.stringify(x));
const ZERO = { manager: 0, host: 0, call: 0, bar: 0, barback: 0, runner: 0 };
const S = {
  cfg: { shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }], dayShift: "Д",
    need: { 1: { ...ZERO, waiter: 2 }, 2: { ...ZERO, waiter: 2 }, 3: { ...ZERO, waiter: 3 } }, split: {},
    rules: { peakDows: [4, 5], highDows: [], closedDows: [], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, normMode: "floor" },
    posRules: { waiter: { pattern: "even" }, manager: { pattern: "even" }, host: { pattern: "even" } },
    staff: [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 },
      { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 },
      { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Белова Дина", pos: "waiter", norm: 160 }] },
  months: {}, savedCfg: [], savedMonth: [],
};
const rpcs = (fn, b) => {
  if (fn === "schedule_load") { const mk = b.p_month || TODAY.slice(0, 7); return { ok: true, venues: [{ venue_key: "main", config: clone(S.cfg) }], months: S.months[mk] ? [{ venue_key: "main", payload: clone(S.months[mk]) }] : [] }; }
  if (fn === "schedule_save_venue") { let v = null; try { v = JSON.parse(b.p_config); } catch (e) {} if (!v) return { ok: false, error: "bad_request" }; S.cfg = v; S.savedCfg.push(clone(v)); return { ok: true }; }
  if (fn === "schedule_save_month") { let v = null; try { v = JSON.parse(b.p_payload); } catch (e) {} if (!v) return { ok: false, error: "bad_request" }; S.months[b.p_month] = v; S.savedMonth.push({ month: b.p_month, payload: clone(v) }); return { ok: true }; }
  if (fn === "schedule_wishes_get") return { ok: true, wishes: [] };
  if (fn === "swap_list") return { ok: true, swaps: [] };
  return undefined;
};

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open({ who = MARIA, token = "tok-maria", light = false, w = 393, h = 852 } = {}) {
  const UK = ukOf(who);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce" });
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const own = rpcs(m[1], body);
      if (own !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null }, brief_reads: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null }, menu_progress_team: { ok: true, rows: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: token, sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), ["sa_sched_wizard_" + R0]: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
// смены по дням в таблице: { день: число смен }
const perDay = (page) => page.evaluate(() => {
  const days = [...document.querySelectorAll("[data-day-open]")].map((e) => Number(e.getAttribute("data-day-open")));
  const out = {}; days.forEach((d) => { out[d] = 0; });
  document.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td.sa-schedcell")]; if (cells.length !== days.length) return;
    cells.forEach((td, i) => { if (/^[ДВ]$/.test((td.innerText || "").trim())) out[days[i]]++; });
  });
  return out;
});
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth;
  return [...document.querySelectorAll("[data-day-type] button, [data-closed-dows] button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; });
const toNext = async (page) => { await page.locator('[data-month-arrow="1"]').first().click(); await sleep(1600); };
const fill = async (page) => { await page.locator('[data-sched-actions] button', { hasText: "Заполнить" }).first().click(); await sleep(2200); };
const openDay = async (page, d) => { await page.locator(`[data-day-open="${d}"]`).first().click(); await sleep(700); };
const closeSheet = async (page) => { await page.mouse.click(196, 40); await sleep(500); };
// заголовок раздела настроек — точным текстом: «часы работы» есть и в пояснении типовых заведений
const openSec = async (page, title) => { await page.getByText(title, { exact: true }).first().click(); await sleep(600); };
const hoursOpen = async (page) => { if (!(await page.locator("[data-closed-dows]").count())) await openSec(page, "Часы работы"); };   // раздел 1 открыт сразу
const hoursSec = (page) => page.locator(".sa-schedsec").filter({ has: page.getByText("Часы работы", { exact: true }) });

let M = null;
await run("HOURS", async () => {
  M = await open();
  await nav(M.page, "schedule", 2600);
  await toNext(M.page);
  await fill(M.page);
  const pd0 = await perDay(M.page);
  ok("HOURS: без выходных «Заполнить» ставит людей и в понедельник", MONS.every((d) => pd0[d] >= 1), JSON.stringify(MONS.map((d) => pd0[d])));
  await M.page.locator("[data-sched-tabs] button", { hasText: "Настройки" }).click(); await sleep(900);
  await hoursOpen(M.page);
  ok("HOURS: пилюли выходных дней — семь, ни одна не включена", (await M.page.locator("[data-closed-dows] [data-closed-dow]").count()) === 7
    && !(await M.page.locator("[data-hours-closed]").count()));
  await M.page.locator('[data-closed-dow="0"]').click(); await sleep(700);
  ok("HOURS: понедельник — строкой «закрыто весь день»", /закрыто весь день/.test(await txt(M.page.locator('[data-hours-closed="0"]'))), await txt(M.page.locator('[data-hours-closed="0"]')));
  const left = Number(await M.page.locator("[data-closed-left]").getAttribute("data-closed-left").catch(() => 0));
  const want0 = MONS.reduce((a, d) => a + pd0[d], 0);
  ok("HOURS: «В закрытые дни остались смены» — столько, сколько стоит в понедельники", left === want0, left + " / " + want0);
  await shot(M.page, "hours-closed-left");
  await M.page.locator("[data-closed-clear]").click(); await sleep(900);
  ok("HOURS: «Снять» — строки больше нет", !(await M.page.locator("[data-closed-left]").count()));
  await sleep(1300);
  const last = S.savedCfg[S.savedCfg.length - 1];
  ok("HOURS: настройки ушли на сервер: closedDows = [0]", !!last && JSON.stringify(last.rules.closedDows) === "[0]", JSON.stringify(last && last.rules));
  await openSec(M.page, "Часы работы");   // свернуть
  ok("HOURS: свёрнутая сводка — «выходной: пн»", /выходной: пн/.test(await txt(hoursSec(M.page))), await txt(hoursSec(M.page)));
});

await run("GEN", async () => {
  if (!M) return ok("GEN: нужен раздел HOURS", false);
  await M.page.locator("[data-sched-tabs] button", { hasText: "График" }).click(); await sleep(1200);
  const pdA = await perDay(M.page);
  ok("GEN: после «Снять» в понедельники пусто", MONS.every((d) => pdA[d] === 0), JSON.stringify(MONS.map((d) => pdA[d])));
  await fill(M.page);
  const pd = await perDay(M.page);
  ok("GEN: «Заполнить» в понедельники никого не ставит", MONS.every((d) => pd[d] === 0), JSON.stringify(MONS.map((d) => pd[d])));
  const open1 = [...Array(NDAYS)].map((_, i) => i + 1).filter((d) => !MONS.includes(d));
  ok("GEN: в открытые дни по два-три официанта", open1.every((d) => pd[d] >= 2), JSON.stringify(open1.filter((d) => pd[d] < 2)));
  const cols = await M.page.evaluate(() => [...document.querySelectorAll("[data-day-closed-col]")].map((e) => Number(e.getAttribute("data-day-closed-col"))));
  ok("GEN: столбцы понедельников заштрихованы", JSON.stringify(cols) === JSON.stringify(MONS), JSON.stringify(cols));
  const strip = await M.page.evaluate(() => [...document.querySelectorAll('[data-strip-closed="1"]')].map((e) => e.getAttribute("data-strip-day") + ":" + e.getAttribute("data-strip-short")));
  ok("GEN: в полоске месяца понедельники — пеньки без недобора", JSON.stringify(strip) === JSON.stringify(MONS.map((d) => d + ":0")), JSON.stringify(strip));
  const shorts = await M.page.evaluate(() => [...document.querySelectorAll("[data-strip-short]")].filter((e) => e.getAttribute("data-strip-short") !== "0").length);
  ok("GEN: недоборов в месяце нет", shorts === 0, String(shorts));
  await M.page.locator("span", { hasText: "что означают буквы?" }).first().click().catch(() => {}); await sleep(300);
  ok("GEN: в обозначениях — «заведение закрыто»", (await M.page.locator("[data-legend-closed]").count()) === 1);
  await shot(M.page, "gen-grid");
});

await run("DAY", async () => {
  if (!M) return ok("DAY: нужен раздел HOURS", false);
  await openDay(M.page, WED);
  const sheet = M.page.locator(`[data-boss-day="${WED}"]`);
  ok("DAY: лист дня — тип дня пилюлями «Обычный · Пиковый · Закрыто», выбран «Обычный»", (await txt(sheet.locator("[data-day-type]"))) === "Обычный Пиковый Закрыто"
    && (await sheet.locator('[data-day-lvl="1"]').getAttribute("aria-checked")) === "true", await txt(sheet.locator("[data-day-type]")));
  await sheet.locator('[data-day-lvl="0"]').click(); await sleep(600);
  ok("DAY: «Закрыто» — «Заведение закрыто · смен: 2», подпись «Закрыто только в эту дату · как в правилах»",
    /^Заведение закрыто · смен: [23]$/.test(await txt(sheet.locator("[data-day-title]"))) && (await txt(sheet.locator("[data-day-why]"))) === "Закрыто только в эту дату · как в правилах",
    (await txt(sheet.locator("[data-day-title]"))) + " | " + (await txt(sheet.locator("[data-day-why]"))));
  await shot(M.page, "day-closed-shifts");
  await sheet.locator("[data-day-clear]").click(); await sleep(700);
  ok("DAY: «Снять смены этого дня» — пусто, вместо силуэта — пояснение", (await txt(sheet.locator("[data-day-title]"))) === "Заведение закрыто"
    && (await sheet.locator("[data-day-closed]").count()) === 1 && !(await sheet.locator("[data-day-skyline]").count()), await txt(sheet.locator("[data-day-title]")));
  await sheet.locator("[data-day-reset]").click(); await sleep(600);
  ok("DAY: «как в правилах» — снова обычный день, подписи нет", /^Обычный день · 0 из 2/.test(await txt(sheet.locator("[data-day-title]"))) && !(await sheet.locator("[data-day-why]").count()),
    await txt(sheet.locator("[data-day-title]")));
  await sheet.locator('[data-day-lvl="0"]').click(); await sleep(500);
  await closeSheet(M.page);
  const pd = await perDay(M.page);
  ok("DAY: в таблице среда " + WED + " пустая и заштрихована", pd[WED] === 0 && (await M.page.locator(`[data-day-closed-col="${WED}"]`).count()) === 1);
  await openDay(M.page, TUE);
  const s2 = M.page.locator(`[data-boss-day="${TUE}"]`);
  await s2.locator('[data-day-lvl="3"]').click(); await sleep(500);
  ok("DAY: «Пиковый» на вторник — «Пиковый день · … из 3», «Своя пометка на эту дату»", /^Пиковый день · \d из 3/.test(await txt(s2.locator("[data-day-title]")))
    && (await txt(s2.locator("[data-day-why]"))) === "Своя пометка на эту дату · как в правилах", (await txt(s2.locator("[data-day-title]"))) + " | " + (await txt(s2.locator("[data-day-why]"))));
  await closeSheet(M.page);
  await openDay(M.page, MON2);
  const s3 = M.page.locator(`[data-boss-day="${MON2}"]`);
  ok("DAY: понедельник — «Заведение закрыто», «Закрыто каждый понедельник: так в «Часах работы»»", (await txt(s3.locator("[data-day-title]"))) === "Заведение закрыто"
    && (await txt(s3.locator("[data-day-why]"))) === "Закрыто каждый понедельник: так в «Часах работы»", await txt(s3.locator("[data-day-why]")));
  await s3.locator('[data-day-lvl="1"]').click(); await sleep(500);
  ok("DAY: банкет — понедельник открыт обычным днём, «Открыты в эту дату, хотя каждый понедельник закрыто»", /^Обычный день · 0 из 2/.test(await txt(s3.locator("[data-day-title]")))
    && /^Открыты в эту дату, хотя каждый понедельник закрыто/.test(await txt(s3.locator("[data-day-why]"))), await txt(s3.locator("[data-day-why]")));
  await shot(M.page, "day-banquet");
  await closeSheet(M.page);
  const save = M.page.locator("[data-savebar] button", { hasText: "Сохранить" });
  if (await save.count()) { await save.click(); await sleep(1800); }
  const pl = S.months[NK];
  ok("DAY: «Сохранить» — пометки дней в месяце", !!pl && pl.days && pl.days[WED] && pl.days[WED].closed === true && pl.days[TUE] && pl.days[TUE].lvl === 3
    && pl.days[MON2] && pl.days[MON2].closed === false, JSON.stringify(pl && pl.days));
  ok("DAY: в сохранённом месяце в закрытые дни смен нет", !!pl && Object.values(pl.plan || {}).every((row) => [WED, ...MONS.filter((d) => d !== MON2)].every((d) => !row[d])));
  const [e1, e2] = noErr(M);
  ok("DAY: без ошибок в консоли", e1, e2);
});

await run("STAFF", async () => {
  const A = await open({ who: ANNA, token: "tok-anna" });
  await nav(A.page, "schedule", 2600);
  await A.page.locator('[data-month-arrow="1"]').first().click(); await sleep(1600);
  const cl = await A.page.evaluate(() => [...document.querySelectorAll("[data-cal-closed]")].map((e) => Number(e.getAttribute("data-cal-closed"))));
  const wantCl = [...MONS.filter((d) => d !== MON2), WED].sort((a, b) => a - b);
  ok("STAFF: «закр.» в закрытые понедельники и в среду " + WED + ", в банкетный понедельник — нет", JSON.stringify(cl) === JSON.stringify(wantCl), JSON.stringify(cl) + " / " + JSON.stringify(wantCl));
  ok("STAFF: в подписи календаря — «заведение закрыто»", /закр\.\s*заведение закрыто/.test(await txt(A.page.locator("[data-sched-cal]"))));
  await shot(A.page, "staff-cal");
  const [e1, e2] = noErr(A);
  ok("STAFF: без ошибок в консоли", e1, e2);
  await A.ctx.close();
});

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const N = await open({ w: 320, h: 700, light });
    await nav(N.page, "schedule", 2600);
    await toNext(N.page);
    await openDay(N.page, WED);
    const a = await fits(N.page), na = await N.page.locator("[data-day-type] button").count();
    await shot(N.page, "narrow-day-" + (light ? "light" : "dark"));
    await closeSheet(N.page);
    await N.page.locator("[data-sched-tabs] button", { hasText: "Настройки" }).click(); await sleep(800);
    await hoursOpen(N.page);
    const b = await fits(N.page), nb = await N.page.locator("[data-closed-dows] button").count();
    ok("NARROW: 320 px, " + (light ? "светлая" : "тёмная") + " — пилюли дня (3) и выходных (7) в экране", a === 0 && b === 0 && na === 3 && nb === 7, [a, b, na, nb].join(" / "));
    await shot(N.page, "narrow-hours-" + (light ? "light" : "dark"));
    await N.ctx.close();
  }
});

if (M) await M.ctx.close();
await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
