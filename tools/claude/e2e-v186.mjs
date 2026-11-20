// e2e v186 (Доп. 511): время за столом полоской и официант цветом.
// Владелец: «Как ещё удобнее и красивее мы можем сделать рассадку?» и «Давай все».
// Разделы:
//   BAR    — доска смены: у столов с гостями и со «Счётом» полоска по краю столешницы; 20 минут — короткая и обычного
//            цвета, 1 ч 10 мин — жёлтая, 1 ч 40 мин — красная и во всю длину (у круглого — круг целиком); у брони,
//            свободного и уборки полоски нет; диктор слышит «сидят …» и официанта; под легендой подсказка;
//   WAITER — рамка вокруг стола цветом официанта: у двух столов Анны одна, у стола Петра другая, у стола без
//            официанта рамки нет; в «Официантах» кружки тех же цветов; нажать на имя — столы подсвечены, ещё раз —
//            сняты; подбор компании снимает подсветку официанта; в карточке стола кружки у имён;
//   EDIT   — в редакторе схемы ни полосок, ни рамок;
//   LOOK   — тёмная и светлая тема, телефон 360 точек без прокрутки вбок, снимки.
// Голова сценария — как в e2e-v185.mjs, без фото.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v186.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5386, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v186";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const R0 = "Два моря, Океан";
const LEAD = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const NOW = new Date("2026-11-20T07:20:00Z");   // 20.11, 19:20 по Камчатке
const iso = (minAgo) => new Date(NOW.getTime() - minAgo * 60000).toISOString();
const SEATSTAFF = [{ id: "e-anna", name: "Анна", surname: "Смирнова", position: "waiter" }, { id: "e-petr", name: "Пётр", surname: "Орлов", position: "waiter" }];

const ABORT = Symbol("abort");
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = LEAD, rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, seedExtra = {} } = {}) {
  const UK = who ? ukOf(who) : "";
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/floor-scan/.test(u)) {
      calls.push({ fn: "floor-scan", body, t: Date.now() });
      const own = rpcs("floor-scan", body);
      if (own === ABORT || own === undefined) return route.abort();
      if (own && own.__status) return route.fulfill({ status: own.__status, contentType: "application/json", body: JSON.stringify(own.body || {}) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(own) });
    }
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
      if (own === ABORT) return route.abort();
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null }, menu_progress_team: { ok: true, rows: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: [] }), ...seedExtra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
  }, seed);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, UK };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const fits = (page, sel) => page.evaluate((sel) => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; return { W, sw: document.documentElement.scrollWidth, over }; }, sel);

// схема в памяти: seat_board / floor_save
function floorServer({ plan = null, rows = [] } = {}) {
  const B = { plan, rows, saves: [] };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") return { ok: true, floor: 2, tall: true, sides: true, day: "2026-11-20", now: NOW.toISOString(), lead: true, plan: B.plan, staff: SEATSTAFF, tables: B.rows };
    if (fn === "floor_save") { B.saves.push(body.p_plan); B.plan = body.p_plan; return { ok: true, v: 2, tables: (body.p_plan.tables || []).length }; }
    return undefined;
  };
  return B;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 6, shape: "long", x: 2, y: 0, z: "z1" },
  { id: "t3", n: "3", seats: 4, shape: "rd", x: 5, y: 0, z: "z1" }, { id: "t4", n: "4", seats: 6, shape: "tall", x: 7, y: 0, z: "z1" },
  { id: "t5", n: "5", seats: 2, shape: "sq", x: 0, y: 3, z: "z1" }, { id: "t6", n: "6", seats: 4, shape: "sq", x: 2, y: 3, z: "z1" },
  { id: "t7", n: "7", seats: 2, shape: "sq", x: 4, y: 3, z: "z1" }] };
const ANNA = "Анна Смирнова", PETR = "Пётр Орлов";
const ROWS = [
  { tid: "t1", status: "seat", cnt: 3, name: "", rtime: "", since: iso(20), waiter_id: "e-anna", waiter_name: ANNA },
  { tid: "t2", status: "seat", cnt: 5, name: "", rtime: "", since: iso(70), waiter_id: "e-petr", waiter_name: PETR },
  { tid: "t3", status: "bill", cnt: 2, name: "", rtime: "", since: iso(100), waiter_id: "e-anna", waiter_name: ANNA },
  { tid: "t4", status: "seat", cnt: 4, name: "", rtime: "", since: iso(10), waiter_id: null, waiter_name: "" },
  { tid: "t5", status: "res", cnt: 2, name: "Ильины", rtime: "20:00", since: iso(5), waiter_id: null, waiter_name: "" },
  { tid: "t7", status: "clean", cnt: 0, name: "", rtime: "", since: iso(3), waiter_id: null, waiter_name: "" }];
const PAL = { dark: { anna: "#4FD1C5", petr: "#B39DFF", warn: "#F2B84B", late: "#FF7A66" }, light: { anna: "#0F7F75", petr: "#6A4FD8", warn: "#A86A0C", late: "#B3362A" } };
async function board(o) { await sleep(1200); await nav(o.page, "seat", 1800); }
// что нарисовано у стола: полоска (уровень, цвет, длина), рамка официанта, подсветка, подпись для диктора
const look = (page, id) => page.evaluate((id) => {
  const e = document.querySelector('[data-floor] [data-table="' + id + '"]');
  if (!e) return null;
  const bar = e.querySelector("[data-sit-bar]"), ring = e.querySelector("[data-waiter-ring]");
  let len = null, full = null;
  if (bar && bar.tagName.toLowerCase() === "line") {
    len = Math.hypot(bar.x2.baseVal.value - bar.x1.baseVal.value, bar.y2.baseVal.value - bar.y1.baseVal.value);
    const top = e.querySelector("[data-table-top]"), w = top.width.baseVal.value, h = top.height.baseVal.value, r = top.rx.baseVal.value, k = Math.min(r, Math.min(w, h) / 2);
    full = Math.max(w, h) - 2 * k;
  } else if (bar) { const d = (bar.getAttribute("stroke-dasharray") || "").split(/\s+/).map(Number); len = d[0]; full = d[1]; }
  return { bar: bar ? bar.getAttribute("data-sit-bar") : null, barColor: bar ? bar.getAttribute("stroke") : null, len, full, kind: bar ? bar.tagName.toLowerCase() : null,
    ring: ring ? ring.getAttribute("stroke") : null, hi: e.getAttribute("data-hi"), label: e.getAttribute("aria-label") || "" };
}, id);
const near = (a, b, eps = 0.06) => a != null && b != null && Math.abs(a - b) <= eps * Math.max(1, b);

if (want("BAR")) {
  for (const light of [false, true]) {
    const tag = "BAR" + (light ? " светлая" : ""), P = PAL[light ? "light" : "dark"];
    const B = floorServer({ plan: clone(PLAN), rows: clone(ROWS) });
    const o = await open({ light, rpcs: B.rpc });
    await board(o);
    const [a1, a2, a3, a4, a5, a6, a7] = await Promise.all(["t1", "t2", "t3", "t4", "t5", "t6", "t7"].map((id) => look(o.page, id)));
    ok(tag + ": 20 минут — полоска обычного цвета, примерно на 2/9 длины стола", a1 && a1.bar === "0" && a1.kind === "line" && near(a1.len / a1.full, 20 / 90, 0.08) && a1.barColor !== P.warn && a1.barColor !== P.late, JSON.stringify(a1));
    ok(tag + ": 1 ч 10 мин — жёлтая, примерно на 7/9", a2 && a2.bar === "1" && a2.barColor === P.warn && near(a2.len / a2.full, 70 / 90, 0.08), JSON.stringify(a2));
    ok(tag + ": «Счёт» 1 ч 40 мин — красная, круг целиком", a3 && a3.bar === "2" && a3.kind === "circle" && a3.barColor === P.late && near(a3.len, a3.full, 0.01), JSON.stringify(a3));
    ok(tag + ": вертикальный стол — полоска по длинной стороне", a4 && a4.bar === "0" && a4.kind === "line" && near(a4.len / a4.full, 10 / 90, 0.1), JSON.stringify(a4));
    ok(tag + ": у брони, свободного и уборки полоски нет", a5 && a6 && a7 && !a5.bar && !a6.bar && !a7.bar);
    ok(tag + ": диктор слышит время и официанта", /гостей 5, сидят 1 ч 10 мин, официант Пётр О\.$/.test(a2.label) && /сидят 10 мин$/.test(a4.label) && !/сидят/.test(a5.label), a2.label + " | " + a4.label);
    const hint = await txt(o.page.locator("[data-board-hint]"));
    ok(tag + ": под легендой подсказка про полоску и рамку", /Полоска по краю стола: сколько сидят гости, через час она жёлтая, через полтора красная\. Рамка вокруг стола цветом официанта\./.test(hint), hint);
    await o.page.locator("[data-floor]").screenshot({ path: OUT + "/board" + (light ? "-light" : "") + ".png" });
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  // все столы свободны — подсказки нет
  const B = floorServer({ plan: clone(PLAN), rows: [] });
  const o = await open({ rpcs: B.rpc });
  await board(o);
  ok("BAR: когда гостей нет — ни полосок, ни подсказки", !(await o.page.locator("[data-sit-bar]").count()) && !(await o.page.locator("[data-board-hint]").count()));
  await o.ctx.close();
}

if (want("WAITER")) {
  for (const light of [false, true]) {
    const tag = "WAITER" + (light ? " светлая" : ""), P = PAL[light ? "light" : "dark"];
    const B = floorServer({ plan: clone(PLAN), rows: clone(ROWS) });
    const o = await open({ light, rpcs: B.rpc });
    await board(o);
    const [a1, a2, a3, a4, a5] = await Promise.all(["t1", "t2", "t3", "t4", "t5"].map((id) => look(o.page, id)));
    ok(tag + ": у двух столов Анны рамка одного цвета, у стола Петра другого", a1.ring === P.anna && a3.ring === P.anna && a2.ring === P.petr, [a1.ring, a2.ring, a3.ring].join(","));
    ok(tag + ": у стола без официанта и у брони рамки нет", !a4.ring && !a5.ring);
    const dot = (id) => o.page.locator(`[data-waiters] [data-waiter-row="${id}"] [data-waiter-dot]`).evaluate((e) => getComputedStyle(e).borderTopColor);
    const rgb = (hex) => "rgb(" + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ") + ")";
    ok(tag + ": в «Официантах» кружки тех же цветов", (await dot("e-anna")) === rgb(P.anna) && (await dot("e-petr")) === rgb(P.petr));
    const help = o.page.locator("[data-waiters]");
    ok(tag + ": подсказка «Нажми на имя»", /Нажми на имя: подсветятся столы официанта\./.test(await txt(help)));
    const anna = o.page.locator('[data-waiter-row="e-anna"]');
    await anna.click(); await sleep(250);
    const hi1 = await Promise.all(["t1", "t2", "t3", "t4"].map(async (id) => (await look(o.page, id)).hi));
    ok(tag + ": нажать «Анна С.» — подсвечены её столы 1 и 3, остальные нет", hi1.join("") === "1010" && (await anna.getAttribute("aria-pressed")) === "true", hi1.join(""));
    ok(tag + ": подсказка меняется — как снять", /Нажми на имя ещё раз, чтобы снять\./.test(await txt(help)));
    if (!light) await o.page.screenshot({ path: OUT + "/waiter-on.png", fullPage: false });
    await o.page.locator('[data-waiter-row="e-petr"]').click(); await sleep(250);
    const hi2 = await Promise.all(["t1", "t2", "t3"].map(async (id) => (await look(o.page, id)).hi));
    ok(tag + ": нажать «Пётр О.» — подсвечен его стол 2", hi2.join("") === "010" && (await anna.getAttribute("aria-pressed")) === "false", hi2.join(""));
    await o.page.locator('[data-party="2"]').click(); await sleep(250);
    ok(tag + ": подбор компании снимает подсветку официанта", (await o.page.locator('[data-waiter-row="e-petr"]').getAttribute("aria-pressed")) === "false" && (await look(o.page, "t6")).hi === "1" && (await look(o.page, "t2")).hi === "0");
    await o.page.locator('[data-party="2"]').click(); await sleep(200);
    await anna.click(); await sleep(200); await anna.click(); await sleep(200);
    ok(tag + ": нажать ещё раз — подсветка снята", !(await o.page.locator('[data-floor] [data-hi="1"]').count()) && (await anna.getAttribute("aria-pressed")) === "false");
    // карточка свободного стола: кружки у имён официантов
    await o.page.locator('[data-floor] [data-table="t6"]').click(); await sleep(350);
    const sheet = o.page.locator('[data-table-sheet="t6"]');
    const sd = (id) => sheet.locator(`[data-waiter="${id}"] [data-waiter-dot]`).evaluate((e) => getComputedStyle(e).borderTopColor).catch(() => null);
    ok(tag + ": в карточке стола у имён кружки тех же цветов", (await sd("e-anna")) === rgb(P.anna) && (await sd("e-petr")) === rgb(P.petr));
    if (!light) await sheet.screenshot({ path: OUT + "/sheet.png" });
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("EDIT")) {
  const B = floorServer({ plan: clone(PLAN), rows: clone(ROWS) });
  const o = await open({ rpcs: B.rpc });
  await board(o);
  ok("EDIT: на доске полоски и рамки есть", (await o.page.locator("[data-floor] [data-sit-bar]").count()) === 4 && (await o.page.locator("[data-floor] [data-waiter-ring]").count()) === 3);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(500);
  const ed = o.page.locator("[data-floor-editor]");
  ok("EDIT: в редакторе схемы ни полосок, ни рамок", (await ed.count()) === 1 && !(await ed.locator("[data-sit-bar]").count()) && !(await ed.locator("[data-waiter-ring]").count()));
  ok("EDIT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LOOK")) {
  for (const [light, w] of [[false, 393], [true, 393], [false, 360]]) {
    const tag = "LOOK" + (light ? " светлая" : "") + (w !== 393 ? " " + w : "");
    const B = floorServer({ plan: clone(PLAN), rows: clone(ROWS) });
    const o = await open({ light, w, rpcs: B.rpc });
    await board(o);
    await o.page.locator('[data-waiter-row="e-anna"]').click(); await sleep(250);
    const f = await fits(o.page, "[data-floor] *, [data-waiters] *, [data-board-hint]");
    ok(tag + ": доска, подсказка и «Официанты» без прокрутки вбок", f.over === 0 && f.sw <= f.W, JSON.stringify(f));
    await o.page.locator("[data-waiters]").scrollIntoViewIfNeeded(); await sleep(150);
    await o.page.screenshot({ path: OUT + "/look" + (light ? "-light" : "") + (w !== 393 ? "-" + w : "") + ".png" });
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
