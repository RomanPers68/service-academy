// e2e v220 (Доп. 546): состав смены и честный график. Сервер графика в памяти, руководитель Мария, официанты Анна,
// Пётр, Вера и Дина; смены День 12–20 и Вечер 16–24.
// Разделы:
//   RULES  — «Правила смен» → «Состав смены и честность»: три правила включены; «Выходные парами» выключили и включили —
//            на сервере rules.pairOff;
//   NEWBIE — «Сотрудники» → Дина → «Новичок»: на сервере newbie, в строке «· новичок», в сводке правил «новичок не один»;
//   ALONE  — сохранённый месяц, где Дина-новичок в один день одна: «Требует внимания» — «Новичок один в смене: Белова
//            Д.», тап — лист дня: «нов.» у имени и «новичок, один: рядом нет опытного»;
//   GEN    — «Заполнить» с новичком: строки «Новичок один в смене» нет, в каждый день рядом с Диной опытный;
//   NARROW — 320 px, обе темы: переключатели правил в экране.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v220.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5420, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v220";
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

const SEC4 = "Правила смен", SEC5 = "Сотрудники";
const sec = (page, t) => page.locator(".sa-schedsec").filter({ has: page.getByText(t, { exact: true }) });
const pressed = async (loc) => (await loc.getAttribute("aria-pressed")) === "true";

let M = null;
await run("RULES", async () => {
  M = await open();
  await nav(M.page, "schedule", 2600);
  await setupTab(M.page);
  await openSec(M.page, SEC4);
  const r = M.page.locator("[data-team-rules]");
  ok("RULES: «Новичок не один», «Пиковые дни поровну», «Выходные парами» — включены", (await txt(r)).includes("Новичок не один") && (await r.locator("[data-team-rule]").count()) === 3
    && (await pressed(r.locator('[data-team-rule="newbieAlone"]'))) && (await pressed(r.locator('[data-team-rule="peakFair"]'))) && (await pressed(r.locator('[data-team-rule="pairOff"]'))));
  ok("RULES: подсказка — «Смены в пт, сб делятся поровну, полставочнику меньше»", /Смены в пт, сб делятся поровну, полставочнику меньше, по его норме\./.test(await txt(r)), await txt(r));
  await r.locator('[data-team-rule="pairOff"]').click(); await sleep(1400);
  ok("RULES: «Выходные парами» выключили — на сервере pairOff: false", lastCfg() && lastCfg().rules.pairOff === false && !(await pressed(r.locator('[data-team-rule="pairOff"]'))));
  await r.locator('[data-team-rule="pairOff"]').click(); await sleep(1400);
  ok("RULES: включили снова — pairOff: true", lastCfg() && lastCfg().rules.pairOff === true);
  await shot(M.page, "rules");
  await openSec(M.page, SEC4);
});

await run("NEWBIE", async () => {
  if (!M) return ok("NEWBIE: нужен раздел RULES", false);
  await openSec(M.page, SEC5);
  await M.page.locator('[data-emp="6"]').locator("div").first().click(); await sleep(600);
  const nb = M.page.locator('[data-emp-newbie="6"]');
  ok("NEWBIE: у Дины «Новичок» выключен, подсказка «одного в смену его не поставим»", (await nb.count()) === 1 && !(await pressed(nb))
    && /одного в смену его не поставим/.test(await txt(M.page.locator('[data-emp="6"]'))));
  await nb.click(); await sleep(1400);
  const st = (lastCfg() || { staff: [] }).staff.find((x) => String(x.id) === "6") || {};
  ok("NEWBIE: «Новичок» — на сервере newbie: true, «В смене с ним всегда кто-то из опытных»", st.newbie === true && (await pressed(nb))
    && /В смене с ним всегда кто-то из опытных/.test(await txt(M.page.locator('[data-emp="6"]'))), JSON.stringify(st));
  await M.page.locator('[data-emp="6"]').locator("div").first().click(); await sleep(500);
  ok("NEWBIE: в свёрнутой строке — «Официант · 160 ч · новичок»", /Официант · 160 ч · новичок/.test(await txt(M.page.locator('[data-emp="6"]'))), await txt(M.page.locator('[data-emp="6"]')));
  await shot(M.page, "newbie");
  await openSec(M.page, SEC5);
  ok("NEWBIE: свёрнутая сводка правил — «новичок не один»", /новичок не один/.test(await txt(sec(M.page, SEC4))), await txt(sec(M.page, SEC4)));
  const [e1, e2] = noErr(M);
  ok("NEWBIE: без ошибок в консоли", e1, e2);
  await M.ctx.close(); M = null;
});

await run("ALONE", async () => {
  S.cfg = { ...S.cfg, staff: S.cfg.staff.map((x) => (x.id === 6 ? { ...x, newbie: true } : x)) };
  const X = TUE, plan = { 3: {}, 4: {}, 5: {}, 6: {} };
  ALL.forEach((d) => { if (d === X) { plan[6][d] = "Д"; plan[3][d] = "В"; } else if (d % 2) { plan[3][d] = "Д"; plan[4][d] = "Д"; } else { plan[5][d] = "Д"; plan[6][d] = "Д"; } });
  // в день X Дина (новичок) в смене одна: обе смены заведения пересекаются, поэтому опытных в этот день нет вовсе
  delete plan[3][X];
  S.months[NK] = { plan, locks: {}, days: {} };
  const A = await open();
  await nav(A.page, "schedule", 2600);
  await toNext(A.page);
  const al = A.page.locator('[data-attn-row="alone"]');
  ok("ALONE: «Требует внимания» — «Новичок один в смене: Белова Д.» с днём " + X, /^Новичок один в смене: Белова Д\./.test(await txt(al))
    && (await al.locator(`[data-attn-aday="${X}"]`).count()) === 1, await txt(al));
  await shot(A.page, "alone-attn");
  await al.locator(`[data-attn-aday="${X}"]`).click(); await sleep(800);
  const sh = A.page.locator(`[data-boss-day="${X}"]`);
  ok("ALONE: лист дня — «нов.» у Дины и «Белова Д., новичок, один: рядом нет опытного (официант)»", (await sh.locator("[data-day-newbie]").count()) === 1
    && /^Белова Д\., новичок, один: рядом нет опытного \(официант\)/.test(await txt(sh.locator('[data-day-alone="6"]'))), await txt(sh.locator("[data-day-alone]")));
  await shot(A.page, "alone-day");
  const [e1, e2] = noErr(A);
  ok("ALONE: без ошибок в консоли", e1, e2);
  await A.ctx.close();
});

await run("GEN", async () => {
  S.cfg = { ...S.cfg, staff: S.cfg.staff.map((x) => (x.id === 6 ? { ...x, newbie: true } : x)) };
  delete S.months[NK];
  const G = await open();
  await nav(G.page, "schedule", 2600);
  await toNext(G.page);
  await fill(G.page);
  ok("GEN: «Заполнить» с новичком — строки «Новичок один в смене» нет", !(await G.page.locator('[data-attn-row="alone"]').count()));
  const ok2 = await G.page.evaluate(() => {
    const days = [...document.querySelectorAll("[data-day-open]")].map((e) => Number(e.getAttribute("data-day-open")));
    const rows = [...document.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("td.sa-schedcell")].map((td) => (td.innerText || "").trim())).filter((r) => r.length === days.length);
    return rows.length;
  });
  ok("GEN: таблица на месте", ok2 >= 4, String(ok2));
  const [e1, e2] = noErr(G);
  ok("GEN: без ошибок в консоли", e1, e2);
  await G.ctx.close();
});

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const N = await open({ w: 320, h: 700, light });
    await nav(N.page, "schedule", 2600);
    await setupTab(N.page);
    await openSec(N.page, SEC4);
    await N.page.locator("[data-team-rules]").scrollIntoViewIfNeeded();
    const a = await wide(N.page, "[data-team-rules] button");
    await shot(N.page, "narrow-rules-" + (light ? "light" : "dark"));
    ok("NARROW: 320 px, " + (light ? "светлая" : "тёмная") + " — переключатели правил в экране", a === 0, String(a));
    await N.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
