// e2e v179 (Доп. 504): схема зала удобнее и красивее; план зала по фото.
// Разделы:
//   LOOK   — доска: стол сверху со стульями (стульев столько, сколько мест; у гостей, счёта и брони закрашено столько,
//            сколько гостей), подходящие компании — подсветка вокруг стола; обе темы;
//   KINDS  — редактор: вид стола (на 2, 4, 6, 8 мест; квадрат, круг, длинный) и нажатия по клеткам; длинный у правого
//            края встаёт левее; «Ещё такой»; «Шаг назад»; «Пронумеровать по порядку» (второе нажатие); выход без
//            сохранения — переспрос («Выйти без них» — схема прежняя); вид стола телефон помнит; сохранение;
//   PHOTO  — «Фото плана» → подложка под сеткой (сетка не короче фото), «Видно» (запоминается до следующего входа),
//            «Расставить столы по фото»: в зале есть столы — «Вместо них / Добавить»; запрос в floor-scan (JPEG до
//            1568 точек, вход), столы на сетке по рядам, номера с плана, бар и вход; подложка обрезана по залу;
//            «Шаг назад»; «Повернуть»; «Убрать фото»; сохранение floor_save v2;
//   ERR    — ответы функции: лимит на день, модель без фото, нет функции (404), нет связи; на фото не план; столов нет;
//   BOARD  — пустая доска: «По фото плана» → редактор с фото → распознавание без вопроса (зал пустой);
//   OLD    — сервер без этапа 37: столы по фото без бара и входа, схема v1;
//   WIDE   — вытянутый в ширину план с плотными рядами: фото поворачивается, столы не теряются;
//   LIGHT  — светлая тема: пустой зал, фото и распознанные столы;
//   NARROW — 320 px: редактор с палитрой и фото — без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v179.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5379, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v179";
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

// ── план зала для фото: 800 × 600, белый лист, стены, 4 квадратных, 3 круглых, 2 длинных стола, бар и вход ──
const PLAN_TABLES = [
  ...[10, 32, 54, 76].map((x, i) => ({ b: [x, 15, x + 8, 25], shape: "square", seats: 4, n: String(i + 1) })),
  ...[15, 45, 75].map((x, i) => ({ b: [x, 44, x + 8, 54], shape: "round", seats: 2, n: String(i + 5) })),
  ...[10, 55].map((x, i) => ({ b: [x, 75, x + 30, 85], shape: "rect", seats: 8, n: String(i + 8) })),
];
const SCAN_OK = { ok: true, v: 1, plan: true, box: [3, 3, 97, 97], tables: PLAN_TABLES, bars: [[88, 6, 96, 38]], doors: [[50, 96]], note: "", model: "anthropic/claude-haiku-5.5", remaining: 19 };
async function drawPng(page, w, h, draw) {
  const url = await page.evaluate(({ w, h, draw }) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.fillStyle = "#000";
    // eslint-disable-next-line no-new-func
    new Function("g", "w", "h", draw)(g, w, h);
    return c.toDataURL("image/png");
  }, { w, h, draw });
  return Buffer.from(url.split(",")[1], "base64");
}
const PLAN_DRAW = `
  const P = (x, y) => [x * w / 100, y * h / 100];
  g.lineWidth = 5; g.strokeRect(...P(3, 3), 94 * w / 100, 94 * h / 100); g.lineWidth = 3; g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  [10, 32, 54, 76].forEach((x, i) => { g.strokeRect(...P(x, 15), 8 * w / 100, 10 * h / 100); g.fillText(String(i + 1), ...P(x + 4, 20)); });
  [15, 45, 75].forEach((x, i) => { g.beginPath(); g.ellipse(...P(x + 4, 49), 4 * w / 100, 5 * h / 100, 0, 0, 7); g.stroke(); g.fillText(String(i + 5), ...P(x + 4, 49)); });
  [10, 55].forEach((x, i) => { g.strokeRect(...P(x, 75), 30 * w / 100, 10 * h / 100); g.fillText(String(i + 8), ...P(x + 15, 80)); });
  g.fillStyle = "#ddd"; g.fillRect(...P(88, 6), 8 * w / 100, 32 * h / 100); g.strokeRect(...P(88, 6), 8 * w / 100, 32 * h / 100); g.fillStyle = "#000"; g.fillText("БАР", ...P(92, 22));
  g.fillText("вход", ...P(50, 93));`;
const WIDE_DRAW = `
  g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 3;
  [60, 200, 340].forEach((y) => { for (let i = 0; i < 10; i++) g.strokeRect(40 + i * 112, y, 70, 90); });`;
// столы вытянутого плана 1200 × 500: 3 ряда по 10
const WIDE_TABLES = [];
[60, 200, 340].forEach((y) => { for (let i = 0; i < 10; i++) { const x = 40 + i * 112; WIDE_TABLES.push({ b: [x / 12, y / 5, (x + 70) / 12, (y + 90) / 5], shape: "square", seats: 4, n: "" }); } });
// размер JPEG из байтов (маркер SOF)
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

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
// схема в памяти: seat_board / floor_save; floor2 — сервер с этапом 37
function floorServer({ has37 = true, plan = null, rows = [], scan = () => SCAN_OK } = {}) {
  const B = { plan, rows, saves: [], scans: [] };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") return { ok: true, ...(has37 ? { floor: 2 } : {}), day: "2026-11-20", now: NOW.toISOString(), lead: true, plan: B.plan, staff: SEATSTAFF, tables: B.rows };
    if (fn === "floor_save") { B.saves.push(body.p_plan); B.plan = body.p_plan; return { ok: true, v: has37 ? 2 : undefined, tables: (body.p_plan.tables || []).length }; }
    if (fn === "floor-scan") { B.scans.push(body); return scan(body, B.scans.length); }
    return undefined;
  };
  return B;
}
const tableBox = (page, id) => page.locator(`[data-floor] [data-table="${id}"]`).evaluate((e) => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height) }));
const cellBox = (page, k) => page.locator(`[data-floor] [data-cell="${k}"]`).evaluate((e) => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width) }));
// стол в клетке x:y — по положению кнопки (отступ стола от края клетки — меньше трети клетки)
const tablesAt = (page) => page.evaluate(() => {
  const fl = document.querySelector("[data-floor-editor] [data-floor]") || document.querySelector("[data-floor]");
  const cell = fl.clientWidth / 8;
  return [...fl.querySelectorAll("[data-table]")].map((e) => ({ id: e.getAttribute("data-table"), x: Math.round((parseFloat(e.style.left) - cell * 0.03) / cell), y: Math.round((parseFloat(e.style.top) - cell * 0.03) / cell),
    wide: parseFloat(e.style.width) > cell * 1.5, chairs: e.querySelectorAll("[data-chair]").length, on: e.querySelectorAll('[data-chair="on"]').length, n: (e.querySelector("span > span") || {}).textContent || "" }));
});

// ── LOOK: доска ──
if (want("LOOK")) {
  const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [{ id: "i1", kind: "bar", x: 5, y: 5, w: 3, h: 1, z: "z1" }, { id: "i2", kind: "door", x: 0, y: 5, z: "z1" }], tables: [
    { id: "t1", n: "1", seats: 2, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 4, shape: "sq", x: 2, y: 0, z: "z1" }, { id: "t3", n: "3", seats: 4, shape: "rd", x: 4, y: 0, z: "z1" },
    { id: "t4", n: "4", seats: 6, shape: "rd", x: 6, y: 0, z: "z1" }, { id: "t5", n: "5", seats: 6, shape: "long", x: 0, y: 2, z: "z1" }, { id: "t6", n: "6", seats: 8, shape: "long", x: 3, y: 2, z: "z1" },
    { id: "t7", n: "7", seats: 4, shape: "sq", x: 6, y: 2, z: "z1" }, { id: "t8", n: "8", seats: 2, shape: "rd", x: 7, y: 3, z: "z1" }] };
  const ROWS = [
    { tid: "t2", status: "seat", cnt: 3, name: "", rtime: "", since: iso(25), waiter_id: "e-anna", waiter_name: "Анна Смирнова" },
    { tid: "t4", status: "bill", cnt: 5, name: "", rtime: "", since: iso(80), waiter_id: "e-petr", waiter_name: "Пётр Орлов" },
    { tid: "t6", status: "res", cnt: 6, name: "Иванов", rtime: "20:30", since: null, waiter_id: null, waiter_name: "" },
    { tid: "t7", status: "clean", cnt: 0, name: "", rtime: "", since: null, waiter_id: null, waiter_name: "" },
  ];
  for (const light of [false, true]) {
    const tag = "LOOK" + (light ? " светлая" : "");
    const B = floorServer({ plan: PLAN, rows: ROWS });
    const o = await open({ light, rpcs: B.rpc });
    await sleep(1200); await nav(o.page, "seat", 1800);
    const at = await tablesAt(o.page), by = Object.fromEntries(at.map((q) => [q.id, q]));
    ok(tag + ": у каждого стола стульев столько, сколько мест (2, 4, 4, 6, 6, 8, 4, 2)", at.map((q) => q.chairs).join(",") === "2,4,4,6,6,8,4,2", at.map((q) => q.chairs).join(","));
    ok(tag + ": закрашено по гостям: гости 3, счёт 5, бронь 6, уборка и свободные 0", [by.t2.on, by.t4.on, by.t6.on, by.t7.on, by.t1.on, by.t5.on].join(",") === "3,5,6,0,0,0", JSON.stringify([by.t2.on, by.t4.on, by.t6.on, by.t7.on]));
    ok(tag + ": круглые — столешница кругом, длинные — на две клетки", (await o.page.locator('[data-table="t3"] circle[data-table-top]').count()) === 1 && (await o.page.locator('[data-table="t2"] rect[data-table-top]').count()) === 1 && by.t5.wide && by.t6.wide && !by.t2.wide);
    ok(tag + ": подписи на столе прежние: «3·25м», «20:30», «счёт», веник у уборки", /3·25м/.test(await txt(o.page.locator('[data-table="t2"]'))) && /20:30/.test(await txt(o.page.locator('[data-table="t6"]'))) && /счёт/.test(await txt(o.page.locator('[data-table="t4"]')))
      && (await o.page.locator('[data-table="t7"] [data-broom]').count()) === 1);
    await o.page.locator('[data-party="4"]').click(); await sleep(250);
    const glow = await o.page.locator("[data-floor] [data-table-glow]").count(), hiN = await o.page.locator('[data-floor] [data-table][data-hi="1"]').count();
    ok(tag + ": «Посадить: 3–4» — подходящие столы подсвечены вокруг", glow === hiN && hiN >= 1, `${glow} / ${hiN}`);
    await shot(o.page, "look-board" + (light ? "-light" : ""));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

// ── KINDS: редактор ──
if (want("KINDS")) {
  const B = floorServer({ plan: { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 2, shape: "sq", x: 2, y: 0, z: "z1" }] } });
  const o = await open({ rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(500);
  const ed = o.page.locator("[data-floor-editor]");
  const kinds = await ed.locator("[data-kinds] [data-kind]").evaluateAll((a) => a.map((e) => e.getAttribute("data-kind") + (e.getAttribute("aria-checked") === "true" ? "*" : "")));
  ok("KINDS: шесть видов стола, по умолчанию «на 4, квадратный»", kinds.join(",") === "2sq,4sq*,4rd,6rd,6long,8long", kinds.join(","));
  ok("KINDS: у вида — подпись для экранного диктора", (await ed.locator('[data-kind="6rd"]').getAttribute("aria-label")) === "Круглый на 6 мест");
  ok("KINDS: «Шаг назад» пока выключен; «Фото плана» есть", (await ed.locator("[data-undo]").isDisabled()) && /Фото плана/.test(await txt(ed.locator("[data-photo]"))));
  await ed.locator('[data-kind="2sq"]').click(); await sleep(100);
  await ed.locator('[data-cell="0:2"]').click(); await sleep(120);
  await ed.locator('[data-cell="1:2"]').click(); await sleep(150);
  let at = await tablesAt(o.page);
  const two = at.filter((q) => q.y === 2);
  ok("KINDS: «на 2» — два стола на 2 места подряд, номера 3 и 4", two.length === 2 && two.every((q) => q.chairs === 2) && two.map((q) => q.n).join(",") === "3,4" && (await txt(ed.locator("[data-seats]"))) === "2", JSON.stringify(two));
  await ed.locator('[data-kind="6long"]').click(); await sleep(100);
  await ed.locator('[data-cell="7:4"]').click(); await sleep(150);
  at = await tablesAt(o.page);
  const lg = at.find((q) => q.y === 4);
  ok("KINDS: длинный у правого края встаёт на клетку левее (6:4), 6 мест", !!lg && lg.x === 6 && lg.wide && lg.chairs === 6, JSON.stringify(lg));
  ok("KINDS: подсказка про «Ещё такой» у выбранного стола", /«Ещё такой» поставит рядом такой же/.test(await txt(ed.locator("[data-editor-hint]"))));
  await ed.locator("[data-edit-copy]").click(); await sleep(150);
  at = await tablesAt(o.page);
  const cp = at.find((q) => q.y === 5);
  ok("KINDS: «Ещё такой» — справа места нет, копия снизу (6:5), длинный на 6, номер 6", !!cp && cp.x === 6 && cp.wide && cp.chairs === 6 && cp.n === "6" && (await ed.locator(`[data-table-edit="${cp.id}"]`).count()) === 1, JSON.stringify(cp));
  await ed.locator("[data-undo]").click(); await sleep(120);
  ok("KINDS: «Шаг назад» — копии нет", (await tablesAt(o.page)).length === 5);
  await ed.locator("[data-undo]").click(); await sleep(120);
  ok("KINDS: ещё «Шаг назад» — нет и длинного", (await tablesAt(o.page)).length === 4);
  // перетащить стол 1 вниз — номера не по порядку → «Пронумеровать по порядку»
  const t1 = ed.locator('[data-table="t1"]'), target = ed.locator('[data-cell="4:5"]');
  const a = await t1.boundingBox(), b = await target.boundingBox();
  await o.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await o.page.mouse.down();
  await o.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await sleep(100); await o.page.mouse.up(); await sleep(300);
  ok("KINDS: стол перетащился — появилась «Пронумеровать по порядку»", (await ed.locator("[data-renumber]").count()) === 1);
  await ed.locator("[data-renumber]").click(); await sleep(120);
  ok("KINDS: первое нажатие — предупреждение", /Номера станут 1, 2, 3… по залам и рядам\. Нажми ещё раз/.test(await txt(ed.locator("[data-renumber]"))));
  await ed.locator("[data-renumber]").click(); await sleep(200);
  at = await tablesAt(o.page);
  const order = at.slice().sort((p, q) => p.y - q.y || p.x - q.x).map((q) => q.n).join(",");
  ok("KINDS: пронумерованы по рядам: 1, 2, 3, 4; кнопка пропала", order === "1,2,3,4" && !(await ed.locator("[data-renumber]").count()) && /пронумерованы по порядку/.test(await txt(ed.locator("[data-editor-note]"))), order);
  await shot(o.page, "kinds-editor");
  // выход без сохранения — переспрос
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(250);
  ok("KINDS: «‹» с несохранённой схемой — переспрос «Сохранить / Выйти без них», редактор открыт", (await o.page.locator("[data-leave-ask]").count()) === 1 && (await o.page.locator("[data-floor-editor]").count()) === 1);
  await shot(o.page, "kinds-leave");
  await o.page.locator("[data-leave-drop]").click(); await sleep(400);
  ok("KINDS: «Выйти без них» — доска со старой схемой (2 стола), на сервер ничего не ушло", !(await o.page.locator("[data-floor-editor]").count()) && (await o.page.locator("[data-floor] [data-table]").count()) === 2 && !B.saves.length);
  // вид стола телефон помнит; без правок выход без вопроса
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  ok("KINDS: вид стола помнит телефон («на 6, длинный»)", (await o.page.locator('[data-kind="6long"]').getAttribute("aria-checked")) === "true");
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(300);
  ok("KINDS: без правок «‹» выходит сразу", !(await o.page.locator("[data-floor-editor]").count()) && !(await o.page.locator("[data-leave-ask]").count()));
  // сохранение: стол «на 6, круглый»
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  await o.page.locator('[data-kind="6rd"]').click(); await o.page.locator('[data-floor-editor] [data-cell="5:3"]').click(); await sleep(150);
  await o.page.locator("[data-floor-save]").click(); await sleep(700);
  const sv = B.saves[0] || {};
  const nt = (sv.tables || []).find((q) => q.x === 5 && q.y === 3) || {};
  ok("KINDS: floor_save — новый стол «на 6, круглый» в 5:3, номер 3", nt.seats === 6 && nt.shape === "rd" && nt.n === "3" && nt.z === "z1", JSON.stringify(nt));
  ok("KINDS: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── PHOTO: фото плана и распознавание ──
if (want("PHOTO")) {
  const B = floorServer({ plan: { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 3, y: 9, z: "z1" }] } });
  const o = await open({ rpcs: B.rpc });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  ok("PHOTO: в зале есть стол — карточки «Быстрее всего по фото» нет", !(await ed.locator("[data-floor-start]").count()));
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  const bg = ed.locator("[data-floor-bg] img");
  const nat = await bg.evaluate((e) => [e.naturalWidth, e.naturalHeight]).catch(() => [0, 0]);
  ok("PHOTO: фото под сеткой (800 × 600), подсказка, карточка «Фото плана»", nat[0] === 800 && nat[1] === 600 && /Фото плана под сеткой/.test(await txt(ed.locator("[data-editor-note]"))) && (await ed.locator("[data-bg-card]").count()) === 1, nat.join("×"));
  const hFloor = await ed.locator("[data-floor]").evaluate((e) => e.clientHeight), hImg = await bg.evaluate((e) => parseFloat(e.style.height));
  ok("PHOTO: сетка не короче фото", hFloor >= hImg - 1, `${hFloor} / ${hImg}`);
  await ed.locator("[data-bg-op]").fill("30"); await sleep(700);
  ok("PHOTO: «Видно» 30% — фото прозрачнее", Math.abs(parseFloat(await bg.evaluate((e) => e.style.opacity)) - 0.3) < 0.01);
  await shot(o.page, "photo-under");
  // выход без правок схемы и снова вход — фото и «Видно» на месте (IndexedDB)
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(300);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(700);
  ok("PHOTO: фото лежит на телефоне: снова в редакторе, «Видно» 30%", (await ed.locator("[data-floor-bg] img").count()) === 1 && Math.abs(parseFloat(await ed.locator("[data-floor-bg] img").evaluate((e) => e.style.opacity)) - 0.3) < 0.01);
  // распознать: в зале уже стол — вопрос
  await ed.locator("[data-scan]").click(); await sleep(200);
  ok("PHOTO: в зале уже 1 стол — «вместо них или добавить»", /В зале уже 1 стол\. Поставить столы с фото вместо них или добавить к ним\?/.test(await txt(ed.locator("[data-scan-ask]"))));
  await shot(o.page, "photo-ask");
  await ed.locator('[data-scan-mode="replace"]').click(); await sleep(1500);
  const req = B.scans[0] || {};
  const jb = req.image ? Buffer.from(String(req.image).split(",")[1] || "", "base64") : Buffer.alloc(0);
  const js = jpegSize(jb) || {};
  ok("PHOTO: в floor-scan ушли вход и JPEG до 1568 точек (с сеткой — те же пропорции 4:3)", req.token === "tok-preview" && /^data:image\/jpeg;base64,/.test(req.image || "") && js.w === 800 && js.h === 600, JSON.stringify(js));
  let at = await tablesAt(o.page);
  const rows = {};
  for (const q of at) (rows[q.y] = rows[q.y] || []).push(q);
  const ys = Object.keys(rows).map(Number).sort((p, q) => p - q);
  const line = (y) => rows[y].sort((p, q) => p.x - q.x);
  ok("PHOTO: 9 столов в три ряда: 4 квадратных, 3 круглых, 2 длинных; старого стола нет", at.length === 9 && ys.length === 3 && line(ys[0]).length === 4 && line(ys[1]).length === 3 && line(ys[2]).length === 2
    && line(ys[2]).every((q) => q.wide) && !at.some((q) => q.x === 3 && q.y === 9), JSON.stringify(at.map((q) => q.n + "@" + q.x + ":" + q.y)));
  ok("PHOTO: номера с плана: 1–4, 5–7, 8–9 по рядам; места с плана", line(ys[0]).map((q) => q.n).join(",") === "1,2,3,4" && line(ys[1]).map((q) => q.n).join(",") === "5,6,7" && line(ys[2]).map((q) => q.n).join(",") === "8,9"
    && line(ys[1]).every((q) => q.chairs === 2) && line(ys[2]).every((q) => q.chairs === 8));
  ok("PHOTO: бар и вход с плана", (await ed.locator('[data-floor] [data-kind="bar"]').count()) === 1 && (await ed.locator('[data-floor] [data-kind="door"]').count()) === 1);
  ok("PHOTO: итог — «Расставил 9 столов по фото, бар и вход.»", /^Расставил 9 столов по фото, бар и вход\./.test(await txt(ed.locator("[data-editor-note]"))), await txt(ed.locator("[data-editor-note]")));
  const nat2 = await ed.locator("[data-floor-bg] img").evaluate((e) => [e.naturalWidth, e.naturalHeight]);
  ok("PHOTO: подложка обрезана по залу (меньше 800 × 600)", nat2[0] < 800 && nat2[0] > 700 && nat2[1] < 600 && nat2[1] > 520, nat2.join("×"));
  await ed.locator("[data-floor]").scrollIntoViewIfNeeded(); await sleep(150);
  await shot(o.page, "photo-scanned");
  await ed.locator("[data-floor]").screenshot({ path: OUT + "/photo-floor.png" });
  await ed.locator("[data-undo]").click(); await sleep(200);
  at = await tablesAt(o.page);
  ok("PHOTO: «Шаг назад» — прежний стол вернулся, бара и входа нет", at.length === 1 && at[0].x === 3 && at[0].y === 9 && !(await ed.locator('[data-floor] [data-kind="bar"]').count()));
  await ed.locator("[data-scan]").click(); await sleep(150);
  await ed.locator('[data-scan-mode="add"]').click(); await sleep(1500);
  at = await tablesAt(o.page);
  const nums = at.map((q) => q.n);
  ok("PHOTO: «Добавить» — 10 столов, номера не повторяются (с плана «1» уже занят — следующий свободный)", at.length === 10 && new Set(nums).size === 10, nums.join(","));
  // повернуть фото
  const n0 = await ed.locator("[data-floor-bg] img").evaluate((e) => [e.naturalWidth, e.naturalHeight]);
  await ed.locator("[data-bg-rotate]").click(); await sleep(900);
  const n1 = await ed.locator("[data-floor-bg] img").evaluate((e) => [e.naturalWidth, e.naturalHeight]);
  ok("PHOTO: «Повернуть» — фото на 90°", n1[0] === n0[1] && n1[1] === n0[0], n0.join("×") + " → " + n1.join("×"));
  await ed.locator("[data-floor-save]").click(); await sleep(800);
  const sv = B.saves[0] || {};
  ok("PHOTO: floor_save v2 — 10 столов, бар и вход, номера разные", sv.v === 2 && (sv.tables || []).length === 10 && (sv.items || []).filter((i) => i.kind === "bar").length === 1 && (sv.items || []).filter((i) => i.kind === "door").length === 1
    && new Set((sv.tables || []).map((t) => t.n)).size === 10);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(700);
  await o.page.locator("[data-bg-drop]").click(); await sleep(300);
  ok("PHOTO: «Убрать фото» — подложки нет, «Фото плана» снова", !(await o.page.locator("[data-floor-bg]").count()) && /Фото плана/.test(await txt(o.page.locator("[data-photo]"))));
  ok("PHOTO: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── ERR: ответы функции ──
if (want("ERR")) {
  const cases = [
    ["лимит на день", () => ({ ok: false, error: "daily_limit", limit: 20 }), /На сегодня распознаваний больше нет/],
    ["модель без фото", () => ({ ok: false, error: "no_vision" }), /Модель ИИ на сервере не принимает фото/],
    ["нет функции (404)", () => ({ __status: 404, body: { code: "NOT_FOUND", message: "Requested function was not found" } }), /На сервере ещё нет функции floor-scan/],
    ["нет связи", () => ABORT, /Сервер не ответил: нет связи или на нём ещё нет функции floor-scan/],
    ["на фото не план", () => ({ ok: true, v: 1, plan: false, tables: [], bars: [], doors: [] }), /Это не похоже на план зала/],
    ["столов нет", () => ({ ok: true, v: 1, plan: true, tables: [], bars: [], doors: [] }), /Столов на фото не нашёл/],
  ];
  const B = floorServer({ plan: null });
  let k = 0;
  B.rpc0 = B.rpc;
  const rpc = (fn, body) => (fn === "floor-scan" ? cases[k][1]() : B.rpc0(fn, body));
  const o = await open({ rpcs: rpc });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  ok("ERR: пустой зал — «Быстрее всего по фото»", (await ed.locator("[data-floor-start]").count()) === 1 && /Сфотографировать план/.test(await txt(ed.locator("[data-floor-photo-start]"))));
  await shot(o.page, "err-start");
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  for (k = 0; k < cases.length; k++) {
    await ed.locator("[data-scan]").click(); await sleep(1300);
    const al = await txt(ed.locator('[role="alert"]'));
    ok("ERR: " + cases[k][0] + " — понятное сообщение, столов нет", cases[k][2].test(al) && !(await ed.locator("[data-floor] [data-table]").count()), al.slice(0, 90));
  }
  ok("ERR: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── BOARD: пустая доска → «По фото плана» ──
if (want("BOARD")) {
  const B = floorServer({ plan: null });
  const o = await open({ rpcs: B.rpc });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  ok("BOARD: пустая доска руководителю — «Нарисовать схему» и «По фото плана»", (await o.page.locator("[data-floor-empty] [data-floor-edit]").count()) === 1 && /По фото плана/.test(await txt(o.page.locator("[data-floor-photo-board]"))));
  await shot(o.page, "board-empty");
  await o.page.locator("[data-floor-file-board]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(1200);
  ok("BOARD: открылся редактор с фото под сеткой", (await o.page.locator("[data-floor-editor] [data-floor-bg] img").count()) === 1 && !(await o.page.locator("[data-floor-start]").count()));
  await o.page.locator("[data-scan]").click(); await sleep(1500);
  ok("BOARD: зал пустой — без вопроса, сразу 9 столов", !(await o.page.locator("[data-scan-ask]").count()) && (await tablesAt(o.page)).length === 9);
  await o.page.locator("[data-floor-save]").click(); await sleep(800);
  ok("BOARD: сохранено — на доске 9 столов", (B.saves[0] || {}).tables && B.saves[0].tables.length === 9 && (await o.page.locator("[data-floor] [data-table]").count()) === 9);
  await shot(o.page, "board-after");
  ok("BOARD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── OLD: сервер без этапа 37 ──
if (want("OLD")) {
  const B = floorServer({ has37: false, plan: null });
  const o = await open({ rpcs: B.rpc });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  ok("OLD: без этапа 37 — палитра столов и фото есть, инструментов нет", (await ed.locator("[data-kinds]").count()) === 1 && (await ed.locator("[data-photo]").count()) === 1 && !(await ed.locator("[data-tools]").count()));
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(1500);
  ok("OLD: столы по фото — без бара и входа", (await tablesAt(o.page)).length === 9 && !(await ed.locator('[data-floor] [data-kind="bar"]').count()) && /^Расставил 9 столов по фото\./.test(await txt(ed.locator("[data-editor-note]"))));
  await ed.locator("[data-floor-save]").click(); await sleep(800);
  const sv = B.saves[0] || {};
  ok("OLD: схема v1 — 9 столов без залов", sv.v === 1 && !sv.zones && !sv.items && (sv.tables || []).length === 9, JSON.stringify(sv).slice(0, 120));
  ok("OLD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── WIDE: вытянутый в ширину план, 30 столов ──
if (want("WIDE")) {
  const B = floorServer({ plan: null, scan: () => ({ ok: true, v: 1, plan: true, box: [0.8, 2, 99.2, 98], tables: WIDE_TABLES, bars: [], doors: [], note: "" }) });
  const o = await open({ rpcs: B.rpc });
  const png = await drawPng(o.page, 1200, 500, WIDE_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  await ed.locator("[data-floor-file]").setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(1800);
  const at = await tablesAt(o.page);
  const nat = await ed.locator("[data-floor-bg] img").evaluate((e) => [e.naturalWidth, e.naturalHeight]);
  ok("WIDE: 30 столов по 10 в ряд — все на сетке (фото повёрнуто: 10 рядов вниз)", at.length === 30 && nat[1] > nat[0], `${at.length}, ${nat.join("×")}`);
  ok("WIDE: итог без «не поместились»", !/не поместил/.test(await txt(ed.locator("[data-editor-note]"))), await txt(ed.locator("[data-editor-note]")));
  await ed.locator("[data-floor]").screenshot({ path: OUT + "/wide-floor.png" });
  ok("WIDE: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── LIGHT: светлая тема — редактор с фото и распознанными столами ──
if (want("LIGHT")) {
  const B = floorServer({ plan: null });
  const o = await open({ rpcs: B.rpc, light: true });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  await shot(o.page, "light-start");
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(1500);
  ok("LIGHT: столы по фото и на светлой теме", (await tablesAt(o.page)).length === 9);
  await ed.locator("[data-floor]").screenshot({ path: OUT + "/light-floor.png" });
  await ed.locator("[data-bg-card]").scrollIntoViewIfNeeded(); await shot(o.page, "light-card");
  ok("LIGHT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── NARROW: 320 px ──
if (want("NARROW")) {
  const B = floorServer({ plan: { v: 2, zones: [{ id: "z1", name: "Зал" }, { id: "z2", name: "Веранда" }], items: [], tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }] } });
  const o = await open({ rpcs: B.rpc, w: 320, h: 700 });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  await o.page.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  const f = await fits(o.page, "[data-floor-editor] *");
  ok("NARROW: редактор с палитрой и фото — без прокрутки вбок", f.over === 0 && f.sw <= f.W, JSON.stringify(f));
  await shot(o.page, "narrow-editor");
  ok("NARROW: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
