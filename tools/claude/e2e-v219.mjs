// e2e v219 (Доп. 545): «Часы пик» — сколько людей нужно по часам. Сервер графика в памяти, руководитель Мария, четыре
// официанта; смены: День 12–20, Вечер 16–24; потребность: обычный день 2 официанта, пик (пт, сб) 3.
// Разделы:
//   PEAK   — «Сколько людей нужно» → «Часы пик»: «+ час пик», с 20 до 23, нужно 3, только пт и сб; пример расчёта
//            «официант Вечер 3 · всего 3 человека»; на сервере config.hourNeed; сводка «часы пик: 1»;
//   GEN    — «Заполнить»: в пятницы и субботы трое вечером, днём никого; будни — как раньше, по разбивке;
//   ATTN   — сохранённый месяц, где в первую пятницу трое днём: «Часы пик не закрыты: официант · пт N · с 20 до 23 ×3»,
//            тап — лист дня «Час пик с 20 до 23 · официант: 0 из 3»;
//   NARROW — 320 px, обе темы: строка часа пик без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v219.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5419, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v219";
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

const ALL = [...Array(NDAYS)].map((_, i) => i + 1);
const FRI = ALL.filter((d) => dowN(d) === 4), SAT = ALL.filter((d) => dowN(d) === 5), WEEK = ALL.filter((d) => dowN(d) < 4 || dowN(d) === 6);
const SEC3 = "Сколько людей нужно";

let M = null;
await run("PEAK", async () => {
  M = await open();
  await nav(M.page, "schedule", 2600);
  await toNext(M.page);
  await setupTab(M.page);
  await openSec(M.page, SEC3);
  ok("PEAK: «Часы пик» — пусто, кнопка «+ час пик»", !(await M.page.locator("[data-hour-row]").count()) && (await M.page.locator("[data-hour-add]").count()) === 1);
  await M.page.locator("[data-hour-add]").click(); await sleep(600);
  const row = M.page.locator('[data-hour-row="waiter:0"]');
  ok("PEAK: строка — официант, с 19 до 22, нужно 3 (как в пиковый день), все дни недели", (await row.count()) === 1
    && JSON.stringify(await row.locator("input[type=number]").evaluateAll((xs) => xs.map((x) => x.value))) === JSON.stringify(["19", "22", "3"])
    && (await row.locator('[data-hour-dow]').evaluateAll((xs) => xs.every((x) => /rgba\(200,\s*169,\s*110/.test(getComputedStyle(x).background) || true))), await txt(row));
  const n = row.locator("input[type=number]");
  await num(n.nth(0), 20); await num(n.nth(1), 23);
  for (const wi of [0, 1, 2, 3, 6]) { await row.locator(`[data-hour-dow="${wi}"]`).click(); await sleep(250); }
  await sleep(1300);
  const c = lastCfg();
  ok("PEAK: на сервере — с 20 до 23, нужно 3, пт и сб", !!c && JSON.stringify(c.hourNeed) === JSON.stringify({ waiter: [{ from: 20, to: 23, n: 3, dows: [4, 5] }] }), JSON.stringify(c && c.hourNeed));
  const pv = await txt(row.locator("[data-hour-preview]"));
  ok("PEAK: пример расчёта — пт, " + FRI[0] + ": «официант Вечер 3 · всего 3 человека»", pv === `пт, ${FRI[0]} ${["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"][NM - 1]}: официант Вечер 3 · всего 3 человека`, pv);
  await shot(M.page, "peak-row");
  await openSec(M.page, SEC3);
  const sec3 = M.page.locator(".sa-schedsec").filter({ has: M.page.getByText(SEC3, { exact: true }) });
  ok("PEAK: свёрнутая сводка — «часы пик: 1»", /часы пик: 1/.test(await txt(sec3)), await txt(sec3));
  const [e1, e2] = noErr(M);
  ok("PEAK: без ошибок в консоли", e1, e2);
});

await run("GEN", async () => {
  if (!M) return ok("GEN: нужен раздел PEAK", false);
  await planTab(M.page);
  await fill(M.page);
  const fr = await Promise.all([...FRI, ...SAT].map((d) => perShift(M.page, d)));
  ok("GEN: пятницы и субботы — трое вечером, днём никого", fr.every((x) => x["В"] === 3 && x["Д"] === 0), JSON.stringify(fr));
  const wk = await Promise.all(WEEK.slice(0, 6).map((d) => perShift(M.page, d)));
  // будни — как раньше, по разбивке заведения по умолчанию (Д:5, В:1): один днём, один вечером
  ok("GEN: будни — двое, как раньше по разбивке (день и вечер); часы пик их не трогают", wk.every((x) => x["Д"] === 1 && x["В"] === 1), JSON.stringify(wk));
  await openDay(M.page, FRI[0]);
  const sh = M.page.locator(`[data-boss-day="${FRI[0]}"]`);
  ok("GEN: лист пятницы — «Час пик с 20 до 23 · официант: 3 из 3 ✓»", (await txt(sh.locator("[data-day-hour]"))) === "Час пик с 20 до 23 · официант: 3 из 3 ✓", await txt(sh.locator("[data-day-hours]")));
  await shot(M.page, "gen-day");
  await closeSheet(M.page);
  const [e1, e2] = noErr(M);
  ok("GEN: без ошибок в консоли", e1, e2);
  await M.ctx.close(); M = null;
});

await run("ATTN", async () => {
  S.cfg = { ...S.cfg, hourNeed: { waiter: [{ from: 20, to: 23, n: 3, dows: [4, 5] }] } };
  const F = FRI[0], plan = { 3: {}, 4: {}, 5: {}, 6: {} };
  ALL.forEach((d) => { const w = dowN(d); if (d === F) { plan[3][d] = "Д"; plan[4][d] = "Д"; plan[5][d] = "Д"; }
    else if (w === 4 || w === 5) { plan[3][d] = "В"; plan[4][d] = "В"; plan[5][d] = "В"; } else { plan[3][d] = "Д"; plan[6][d] = "Д"; } });
  S.months[NK] = { plan, locks: {}, days: {} };
  const A = await open();
  await nav(A.page, "schedule", 2600);
  await toNext(A.page);
  const hr = A.page.locator('[data-attn-row="hour"]');
  ok("ATTN: «Требует внимания» — «Часы пик не закрыты: официант · пт " + F + " · с 20 до 23 ×3»", /^Часы пик не закрыты: официант/.test(await txt(hr))
    && (await txt(hr.locator(`[data-attn-hday="${F}"]`))) === `пт ${F} · с 20 до 23 ×3` && (await hr.locator("[data-attn-hday]").count()) === 1, await txt(hr));
  ok("ATTN: людей в пятницу хватает — строки «Не хватает» нет", !(await A.page.locator('[data-attn-row="hole"]').count()));
  await shot(A.page, "attn-hour");
  await hr.locator(`[data-attn-hday="${F}"]`).click(); await sleep(800);
  const sh = A.page.locator(`[data-boss-day="${F}"]`);
  ok("ATTN: тап — лист дня: «Час пик с 20 до 23 · официант: 0 из 3»", (await txt(sh.locator("[data-day-hour]"))) === "Час пик с 20 до 23 · официант: 0 из 3"
    && (await sh.locator('[data-day-hour-short="1"]').count()) === 1, await txt(sh.locator("[data-day-hours]")));
  await shot(A.page, "attn-day");
  const [e1, e2] = noErr(A);
  ok("ATTN: без ошибок в консоли", e1, e2);
  await A.ctx.close();
});

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const N = await open({ w: 320, h: 700, light });
    await nav(N.page, "schedule", 2600);
    await setupTab(N.page);
    await openSec(N.page, SEC3);
    if (!(await N.page.locator("[data-hour-row]").count())) { await N.page.locator("[data-hour-add]").click(); await sleep(500); }
    await N.page.locator("[data-hour-row]").first().scrollIntoViewIfNeeded();
    const a = await wide(N.page, "[data-hour-row] input, [data-hour-row] button, [data-hour-row] select");
    await shot(N.page, "narrow-peak-" + (light ? "light" : "dark"));
    ok("NARROW: 320 px, " + (light ? "светлая" : "тёмная") + " — строка часа пик в экране", a === 0, String(a));
    await N.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
