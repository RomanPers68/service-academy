// e2e v216 (Доп. 542): «Особые дни» и люди по дням недели. Сервер графика в памяти, руководитель Мария (старший —
// правит график), четыре официанта. Владелец: «ресторан не работает только 31 декабря и 1-го января. А 2-го не с 11, а
// с 16 ти работает». Месяц — следующий за сегодняшним (в нём ничего не заморожено) и тот, что за ним.
// Разделы:
//   DATES — «Часы работы» → «Особые дни»: «Пока ни одной даты»; 31 декабря и 1 января «Закрыто» (с подписью), 2 января
//           «Свои часы» с 16 до 24, дата со «Своим числом людей»; правка строкой, «Обычный»; ✕ убирает дату; сводка
//           «особых дней: 3»; всё уходит на сервер в config.dates;
//   NEED  — «Сколько людей нужно» → «По дням недели»: семь полей на должность из чисел по типу дня, суббота — 4;
//           needMode и needDow на сервере; сводка «по дням недели: …»;
//   GEN   — «Заполнить»: в закрытую дату никого, в субботы по 4, в пятницы по 3; лист дня: «Закрыто в эту дату: так в
//           «Особых днях»»; январь: 1-го никого, 2-го только «Вечер» (с 16); лист дня — «свои часы: с 16:00 до 24:00»,
//           ссылка «изменить в «Особых днях»» открывает форму этой даты; «Пиковый» в листе дня — в «Особые дни»;
//   NARROW — 320 px, обе темы: форма даты и семь полей дней недели без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v216.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5416, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v216";
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
  cfg: { hours: [[12, 24], [12, 24], [12, 24], [12, 24], [12, 24], [12, 24], [12, 24]],
    shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }], dayShift: "Д",
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

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const DEC31 = iso(NY, NM, NDAYS);                     // последний день следующего месяца (в ноябре — 31 декабря)
const MM = NM === 12 ? 1 : NM + 1, MY = NM === 12 ? NY + 1 : NY;   // месяц после следующего
const JAN1 = iso(MY, MM, 1), JAN2 = iso(MY, MM, 2);
const dowAt = (s) => (new Date(s + "T12:00:00Z").getUTCDay() + 6) % 7;
const DOWL = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"], MONR = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const lab = (s) => { const [y, m, d] = s.split("-").map(Number); return `${d} ${MONR[m - 1]}${y !== TY ? " " + y : ""}, ${DOWL[dowAt(s)]}`; };
const WEDI = iso(NY, NM, WED);
const lastCfg = () => S.savedCfg[S.savedCfg.length - 1] || null;
const setupTab = async (page) => { await page.locator("[data-sched-tabs] button", { hasText: "Настройки" }).click(); await sleep(900); };
const planTab = async (page) => { await page.locator("[data-sched-tabs] button", { hasText: "График" }).click(); await sleep(1200); };
const form = (page) => page.locator("[data-date-form]");
const rowTxt = (page, s) => txt(page.locator(`[data-date-row="${s}"] [data-date-text]`));
const num = async (loc, v) => { await loc.fill(String(v)); await loc.press("Enter"); await sleep(250); };
const addDate = async (page, s, fn) => {
  await page.locator("[data-date-add]").click(); await sleep(400);
  await form(page).locator("[data-date-iso]").fill(s); await sleep(300);
  if (fn) await fn(form(page));
  await form(page).locator("[data-date-save]").click(); await sleep(500);
};
const perShift = (page, d) => page.evaluate((d) => {
  const days = [...document.querySelectorAll("[data-day-open]")].map((e) => Number(e.getAttribute("data-day-open")));
  const i = days.indexOf(d), out = { "Д": 0, "В": 0 };
  document.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td.sa-schedcell")]; if (cells.length !== days.length || i < 0) return;
    const t = (cells[i].innerText || "").trim(); if (out[t] !== undefined) out[t]++;
  });
  return out;
}, d);
const wide = (page, sel) => page.evaluate((sel) => { const W = document.documentElement.clientWidth;
  return [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; }, sel);

let M = null;
await run("DATES", async () => {
  M = await open();
  await nav(M.page, "schedule", 2600);
  await setupTab(M.page);
  ok("DATES: «Особые дни» — «Пока ни одной даты», кнопка «+ добавить дату»", /Пока ни одной даты/.test(await txt(M.page.locator("[data-dates-list]")))
    && (await M.page.locator("[data-date-add]").count()) === 1, await txt(M.page.locator("[data-dates-list]")));
  await M.page.locator("[data-date-add]").click(); await sleep(400);
  ok("DATES: пустая форма — «Добавить дату» неактивна, пока нет даты", (await form(M.page).count()) === 1 && (await form(M.page).locator("[data-date-save]").isDisabled()));
  await form(M.page).locator("[data-date-cancel]").click(); await sleep(300);
  await addDate(M.page, DEC31, async (f) => { await f.locator('[data-date-closed="1"]').click(); await sleep(200); });
  ok("DATES: " + DEC31 + " «Закрыто» — строка «" + lab(DEC31) + " · закрыто»", (await txt(M.page.locator(`[data-date-row="${DEC31}"]`))).startsWith(lab(DEC31) + " · закрыто"),
    await txt(M.page.locator(`[data-date-row="${DEC31}"]`)));
  await addDate(M.page, JAN1, async (f) => { await f.locator('[data-date-closed="1"]').click(); await sleep(200);
    await f.locator("input:not([type=date]):not([type=number])").fill("Новый год"); await sleep(200); });
  ok("DATES: 1-е число «Закрыто» с подписью — «закрыто · Новый год»", (await rowTxt(M.page, JAN1)) === "закрыто · Новый год", await rowTxt(M.page, JAN1));
  await addDate(M.page, JAN2, async (f) => {
    await f.locator("[data-date-own]").click(); await sleep(250);
    const n = f.locator("input[type=number]"); await num(n.nth(0), 16); await num(n.nth(1), 24);
  });
  ok("DATES: 2-е число — «Свои часы» с 16 до 24", (await rowTxt(M.page, JAN2)) === "с 16:00 до 24:00", await rowTxt(M.page, JAN2));
  await addDate(M.page, WEDI, async (f) => {
    await f.locator("[data-date-need-on]").click(); await sleep(250);
    const w = f.locator('[data-date-need="waiter"] input');
    ok("DATES: «Своё число людей» — по должностям с людьми, официантов сначала как обычно (2)", (await f.locator("[data-date-need]").count()) === 3
      && (await w.inputValue()) === "2", (await f.locator("[data-date-need]").count()) + " / " + (await w.inputValue()));
    await num(w, 4);
  });
  ok("DATES: дата со своим числом — «4 чел.»", (await rowTxt(M.page, WEDI)) === "4 чел.", await rowTxt(M.page, WEDI));
  const order = await M.page.evaluate(() => [...document.querySelectorAll("[data-date-row]")].map((e) => e.getAttribute("data-date-row")));
  ok("DATES: список по порядку дат", JSON.stringify(order) === JSON.stringify([WEDI, DEC31, JAN1, JAN2].sort()), JSON.stringify(order));
  await shot(M.page, "dates-list");
  // правка строкой: 2-е число — «Обычный»
  await M.page.locator(`[data-date-row="${JAN2}"] [role=button]`).click(); await sleep(400);
  ok("DATES: правка — форма с этой датой, «Свои часы» включены, «Сохранить дату»", (await form(M.page).locator("[data-date-iso]").inputValue()) === JAN2
    && (await form(M.page).locator("[data-date-own]").getAttribute("aria-pressed")) === "true"
    && (await txt(form(M.page).locator("[data-date-save]"))) === "Сохранить дату", await form(M.page).locator("[data-date-iso]").inputValue());
  await form(M.page).locator('[data-date-lvl="1"]').click(); await sleep(200);
  await form(M.page).locator("[data-date-save]").click(); await sleep(500);
  ok("DATES: после правки — «с 16:00 до 24:00 · обычный»", (await rowTxt(M.page, JAN2)) === "с 16:00 до 24:00 · обычный", await rowTxt(M.page, JAN2));
  await M.page.locator(`[data-date-del="${WEDI}"]`).click(); await sleep(600);
  ok("DATES: ✕ — даты нет в списке", !(await M.page.locator(`[data-date-row="${WEDI}"]`).count()));
  await sleep(1300);
  const c = lastCfg(), ds = (c && c.dates) || {};
  ok("DATES: на сервере config.dates — три даты как в списке", JSON.stringify(ds) === JSON.stringify({ [DEC31]: { closed: true }, [JAN1]: { closed: true, note: "Новый год" },
    [JAN2]: { hours: [16, 24], lvl: 1 } }), JSON.stringify(ds));
  await openSec(M.page, "Часы работы");   // свернуть
  ok("DATES: свёрнутая сводка — «особых дней: 3»", /особых дней: 3/.test(await txt(hoursSec(M.page))), await txt(hoursSec(M.page)));
  const [e1, e2] = noErr(M);
  ok("DATES: без ошибок в консоли", e1, e2);
});

await run("NEED", async () => {
  if (!M) return ok("NEED: нужен раздел DATES", false);
  await openSec(M.page, "Сколько людей нужно");
  ok("NEED: «По типу дня» выбран, полей дней недели нет", (await M.page.locator('[data-need-mode-pick="levels"]').getAttribute("aria-checked")) === "true"
    && !(await M.page.locator("[data-need-dow]").count()));
  await M.page.locator('[data-need-mode-pick="dows"]').click(); await sleep(700);
  const vals = await M.page.locator('[data-need-dow="waiter"] input').evaluateAll((xs) => xs.map((x) => x.value));
  ok("NEED: «По дням недели» — официанты из чисел по типу дня: будни 2, пятница и суббота 3", JSON.stringify(vals) === JSON.stringify(["2", "2", "2", "2", "3", "3", "2"]), JSON.stringify(vals));
  ok("NEED: строки — по должностям с людьми (менеджер, хостес, официант)", (await M.page.locator("[data-need-dow]").count()) === 3);
  await num(M.page.locator('[data-need-dow="waiter"] input').nth(5), 4);
  await sleep(1300);
  const c = lastCfg();
  ok("NEED: на сервере needMode «dows», суббота — 4", !!c && c.rules.needMode === "dows" && JSON.stringify(c.needDow && c.needDow.waiter) === "[2,2,2,2,3,4,2]",
    JSON.stringify(c && { m: c.rules.needMode, n: c.needDow }));
  await shot(M.page, "need-dows");
  await openSec(M.page, "Сколько людей нужно");
  const sec3 = M.page.locator(".sa-schedsec").filter({ has: M.page.getByText("Сколько людей нужно", { exact: true }) });
  ok("NEED: свёрнутая сводка — «по дням недели: 2 2 2 2 3 4 2 чел.»", /по дням недели: 2 2 2 2 3 4 2 чел\./.test(await txt(sec3)), await txt(sec3));
});

await run("GEN", async () => {
  if (!M) return ok("GEN: нужен раздел DATES", false);
  await planTab(M.page);
  await toNext(M.page);
  await fill(M.page);
  const pd = await perDay(M.page);
  const sats = [...Array(NDAYS)].map((_, i) => i + 1).filter((d) => dowN(d) === 5), fris = [...Array(NDAYS)].map((_, i) => i + 1).filter((d) => dowN(d) === 4);
  ok("GEN: " + DEC31 + " (закрыто датой) — никого", pd[NDAYS] === 0, String(pd[NDAYS]));
  ok("GEN: субботы — по 4, пятницы — по 3, среда " + WED + " (дату убрали) — 2", sats.every((d) => pd[d] === 4) && fris.filter((d) => d !== NDAYS).every((d) => pd[d] === 3) && pd[WED] === 2,
    JSON.stringify({ s: sats.map((d) => pd[d]), f: fris.map((d) => pd[d]), w: pd[WED] }));
  await openDay(M.page, NDAYS);
  const sh = M.page.locator(`[data-boss-day="${NDAYS}"]`);
  ok("GEN: лист последнего дня — «Заведение закрыто», «Закрыто в эту дату: так в «Особых днях» · как в правилах»",
    (await txt(sh.locator("[data-day-title]"))) === "Заведение закрыто" && (await txt(sh.locator("[data-day-why]"))) === "Закрыто в эту дату: так в «Особых днях» · как в правилах",
    (await txt(sh.locator("[data-day-title]"))) + " | " + (await txt(sh.locator("[data-day-why]"))));
  ok("GEN: в листе — «изменить в «Особых днях»»", (await txt(sh.locator("[data-day-special]"))) === "изменить в «Особых днях»");
  await closeSheet(M.page);
  // «Пиковый» в листе дня — в «Особые дни», без «Сохранить»
  await openDay(M.page, TUE);
  await M.page.locator(`[data-boss-day="${TUE}"] [data-day-lvl="3"]`).click(); await sleep(1500);
  const c = lastCfg(), tk = iso(NY, NM, TUE);
  ok("GEN: «Пиковый» во вторник " + TUE + " — сразу в config.dates, пометки месяца нет", !!c && c.dates[tk] && c.dates[tk].lvl === 3
    && !((S.months[NK] || {}).days || {})[TUE], JSON.stringify(c && c.dates[tk]));
  await closeSheet(M.page);
  await toNext(M.page);
  await fill(M.page);
  const j1 = await perShift(M.page, 1), j2 = await perShift(M.page, 2);
  ok("GEN: 1-е число — никого; 2-е — только «Вечер» (с 16), по субботней норме 4", j1["Д"] + j1["В"] === 0 && j2["Д"] === 0 && j2["В"] === (dowAt(JAN2) === 5 ? 4 : j2["В"]) && j2["В"] >= 2,
    JSON.stringify({ j1, j2 }));
  await shot(M.page, "gen-jan");
  await openDay(M.page, 2);
  const s2 = M.page.locator('[data-boss-day="2"]');
  ok("GEN: лист 2-го — «Своя пометка на эту дату · свои часы: с 16:00 до 24:00»", /^Своя пометка на эту дату · свои часы: с 16:00 до 24:00 · как в правилах$/.test(await txt(s2.locator("[data-day-why]"))),
    await txt(s2.locator("[data-day-why]")));
  await s2.locator("[data-day-special]").click(); await sleep(1100);
  ok("GEN: ссылка из листа дня — «Настройки», форма даты 2-го числа", (await form(M.page).count()) === 1 && (await form(M.page).locator("[data-date-iso]").inputValue()) === JAN2,
    await form(M.page).locator("[data-date-iso]").inputValue().catch(() => "нет формы"));
  await shot(M.page, "day-to-dates");
  await form(M.page).locator("[data-date-cancel]").click(); await sleep(300);
  const [e1, e2] = noErr(M);
  ok("GEN: без ошибок в консоли", e1, e2);
});

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const N = await open({ w: 320, h: 700, light });
    await nav(N.page, "schedule", 2600);
    await setupTab(N.page);
    await N.page.locator("[data-date-add]").click(); await sleep(400);
    await form(N.page).locator("[data-date-own]").click(); await sleep(200);
    await form(N.page).locator("[data-date-need-on]").click(); await sleep(300);
    const a = await wide(N.page, "[data-date-form] button, [data-date-form] input");
    await form(N.page).scrollIntoViewIfNeeded(); await shot(N.page, "narrow-date-form-" + (light ? "light" : "dark"));
    await openSec(N.page, "Сколько людей нужно");
    await N.page.locator('[data-need-mode-pick="dows"]').click(); await sleep(600);
    const b = await wide(N.page, "[data-need-dow] input, [data-need-mode] button"), nb = await N.page.locator('[data-need-dow="waiter"] input').count();
    await N.page.locator("[data-need-dow]").first().scrollIntoViewIfNeeded(); await shot(N.page, "narrow-need-" + (light ? "light" : "dark"));
    ok("NARROW: 320 px, " + (light ? "светлая" : "тёмная") + " — форма даты и семь полей дней недели в экране", a === 0 && b === 0 && nb === 7, [a, b, nb].join(" / "));
    const [e1, e2] = noErr(N);
    ok("NARROW: " + (light ? "светлая" : "тёмная") + " — без ошибок в консоли", e1, e2);
    await N.ctx.close();
  }
});

if (M) await M.ctx.close();
await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
